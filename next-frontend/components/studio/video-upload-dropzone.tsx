"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { UploadDropzone } from "@/components/studio/upload-dropzone";
import { useUpload } from "@/components/studio/upload-provider";
import type { ApiErrorEnvelope, VideoResponse } from "@/lib/api/contracts";

const MAX_FILENAME_LENGTH = 255;
const DRAFT_FAILURE_MESSAGE =
  "Could not create the video draft. Please try again.";

// `CreateVideoDto` in the contract resolves to an empty object type (the upstream export runs
// without the swagger plugin), so the wire shape is spelled out here.
interface CreateVideoRequest {
  filename: string;
  sizeBytes: number;
  contentType: string;
}

function envelopeMessage(envelope: ApiErrorEnvelope | null): string {
  if (!envelope) return DRAFT_FAILURE_MESSAGE;
  return Array.isArray(envelope.message)
    ? envelope.message.join(" ")
    : envelope.message;
}

// Connects the dropzone to the upload provider and the BFF: validate → addFile (Uppy
// restrictions) → POST /api/videos → start(publicId) → navigate to the video page.
export function VideoUploadDropzone() {
  const router = useRouter();
  const { addFile, start, clear } = useUpload();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function handleFileSelected(file: File) {
    if (inFlight.current) return;
    setError(null);

    if (file.name.length < 1 || file.name.length > MAX_FILENAME_LENGTH) {
      setError(
        `The file name must have between 1 and ${MAX_FILENAME_LENGTH} characters.`,
      );
      return;
    }

    try {
      addFile(file);
    } catch (restrictionError) {
      setError(
        restrictionError instanceof Error
          ? restrictionError.message
          : "This file cannot be uploaded.",
      );
      return;
    }

    inFlight.current = true;
    setPending(true);

    const request: CreateVideoRequest = {
      filename: file.name,
      sizeBytes: file.size,
      contentType: file.type,
    };

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (response.status === 401) {
        clear();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const envelope = (await response
          .json()
          .catch(() => null)) as ApiErrorEnvelope | null;
        clear();
        setError(
          response.status === 400
            ? envelopeMessage(envelope)
            : DRAFT_FAILURE_MESSAGE,
        );
        inFlight.current = false;
        setPending(false);
        return;
      }

      const video = (await response.json()) as VideoResponse;
      // The upload keeps running in the provider after the navigation.
      void start(video.publicId);
      router.push(`/studio/videos/${video.publicId}`);
    } catch {
      clear();
      setError(DRAFT_FAILURE_MESSAGE);
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <UploadDropzone
      onFileSelected={handleFileSelected}
      loading={pending}
      error={error}
    />
  );
}
