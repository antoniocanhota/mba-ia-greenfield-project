"use client";

import type Uppy from "@uppy/core";
import { UppyContextProvider, useUppyEvent } from "@uppy/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ApiErrorEnvelope, VideoResponse } from "@/lib/api/contracts";
import { createUppy } from "@/lib/studio/create-uppy";

export type UploadPhase = "uploading" | "completing" | "completed" | "error";

export interface UploadState {
  fileName: string;
  progress: number;
  phase: UploadPhase;
  error?: string;
  errorCode?: string;
  video?: VideoResponse;
}

interface UploadContextValue {
  /** Applies the Uppy restrictions; throws the Uppy restriction error when violated. */
  addFile: (file: File) => void;
  /** Starts sending the picked file for the given draft. */
  start: (publicId: string) => Promise<void>;
  /** Drops the file from Uppy so a new upload can start. */
  clear: () => void;
  getUpload: (publicId: string) => UploadState | undefined;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const value = useContext(UploadContext);
  if (!value)
    throw new Error("useUpload must be used within an UploadProvider");
  return value;
}

const activeDraft = (uppy: Uppy) =>
  uppy.getState().meta.publicId as string | undefined;

const toPercent = (uploaded: number, total: number | null) =>
  total ? Math.min(100, Math.max(0, Math.round((uploaded / total) * 100))) : 0;

// One Uppy instance above the /studio routes, so an upload started on /studio/upload keeps
// going after the client-side navigation to /studio/videos/{publicId}. Nothing is persisted:
// resuming is limited to the browser session (phase-03-videos/TD-04).
export function UploadProvider({ children }: { children: ReactNode }) {
  const completed = useRef(new Set<string>());
  // The draft being uploaded lives in Uppy's own meta: the signer reads it at sign time and
  // the event handlers below read it too, so there is a single source for "which draft".
  const [uppy] = useState<Uppy>(() => {
    const instance: Uppy = createUppy({
      getPublicId: () => activeDraft(instance),
    });
    return instance;
  });
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});

  const patch = useCallback(
    (
      publicId: string,
      changes: Partial<UploadState>,
      onlyIfPhase?: UploadPhase,
    ) =>
      setUploads((current) => {
        const previous = current[publicId];
        if (!previous || (onlyIfPhase && previous.phase !== onlyIfPhase))
          return current;
        return { ...current, [publicId]: { ...previous, ...changes } };
      }),
    [],
  );

  const complete = useCallback(
    async (publicId: string) => {
      try {
        const response = await fetch(
          `/api/videos/${encodeURIComponent(publicId)}/upload-completion`,
          { method: "POST" },
        );
        if (response.ok) {
          patch(publicId, {
            phase: "completed",
            progress: 100,
            video: (await response.json()) as VideoResponse,
          });
        } else {
          const envelope = (await response
            .json()
            .catch(() => null)) as ApiErrorEnvelope | null;
          patch(publicId, {
            phase: "error",
            errorCode: envelope?.error ?? "UPLOAD_COMPLETION_FAILED",
            error: [envelope?.message ?? "Upload completion failed"]
              .flat()
              .join(", "),
          });
        }
      } catch {
        patch(publicId, {
          phase: "error",
          errorCode: "NETWORK_ERROR",
          error: "Could not reach the server to complete the upload",
        });
      } finally {
        // The file is done (or failed for good): free Uppy for the next upload.
        uppy.clear();
      }
    },
    [patch, uppy],
  );

  const onProgress = useCallback(
    (
      _file: unknown,
      progress: { bytesUploaded: number | false; bytesTotal: number | null },
    ) => {
      const publicId = activeDraft(uppy);
      if (!publicId) return;
      patch(
        publicId,
        {
          progress: toPercent(
            Number(progress.bytesUploaded) || 0,
            progress.bytesTotal,
          ),
        },
        "uploading",
      );
    },
    [patch, uppy],
  );

  const onSuccess = useCallback(() => {
    const publicId = activeDraft(uppy);
    // Completion is requested exactly once per draft.
    if (!publicId || completed.current.has(publicId)) return;
    completed.current.add(publicId);
    patch(publicId, { phase: "completing", progress: 100 });
    void complete(publicId);
  }, [complete, patch, uppy]);

  const onError = useCallback(
    (_file: unknown, error: { message: string }) => {
      const publicId = activeDraft(uppy);
      if (!publicId) return;
      patch(
        publicId,
        { phase: "error", errorCode: "UPLOAD_FAILED", error: error.message },
        "uploading",
      );
    },
    [patch, uppy],
  );

  useUppyEvent(uppy, "upload-progress", onProgress);
  useUppyEvent(uppy, "upload-success", onSuccess);
  useUppyEvent(uppy, "upload-error", onError);

  const value = useMemo<UploadContextValue>(
    () => ({
      addFile: (file) => {
        uppy.addFile({ name: file.name, type: file.type, data: file });
      },
      start: async (publicId) => {
        uppy.setMeta({ publicId });
        const fileName = uppy.getFiles()[0]?.name ?? "";
        setUploads((current) => ({
          ...current,
          [publicId]: { fileName, progress: 0, phase: "uploading" },
        }));
        try {
          await uppy.upload();
        } catch (error) {
          patch(
            publicId,
            {
              phase: "error",
              errorCode: "UPLOAD_FAILED",
              error: error instanceof Error ? error.message : "Upload failed",
            },
            "uploading",
          );
        }
      },
      clear: () => {
        uppy.setMeta({ publicId: undefined });
        uppy.clear();
      },
      getUpload: (publicId) => uploads[publicId],
    }),
    [patch, uploads, uppy],
  );

  return (
    <UppyContextProvider uppy={uppy}>
      <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
    </UppyContextProvider>
  );
}
