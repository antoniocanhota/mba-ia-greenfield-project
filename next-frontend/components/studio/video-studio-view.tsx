"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { DownloadIcon } from "@/components/icons/download-icon";
import { ProcessingStatus } from "@/components/studio/processing-status";
import { ThumbUpload } from "@/components/studio/thumb-upload";
import { UploadProgressPanel } from "@/components/studio/upload-progress-panel";
import { useUpload } from "@/components/studio/upload-provider";
import { VideoDetailsCard } from "@/components/studio/video-details-card";
import { VideoStatusBadge } from "@/components/studio/video-status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { useVideoStatus } from "@/hooks/use-video-status";
import type { MediaUrlsResponse, VideoResponse } from "@/lib/api/contracts";
import {
  failureReasonCopy,
  formatDuration,
  processingStatusCopy,
  publicVideoUrl,
  qualityLabel,
} from "@/lib/videos/format";

type MediaState =
  { status: "ready"; urls: MediaUrlsResponse } | { status: "error" };

const noopSubscribe = () => () => {};

const UPLOAD_ERROR_COPY: Record<string, string> = {
  UPLOAD_INCOMPLETE:
    "The file was not fully uploaded. Select the file again to resume.",
  FILE_TOO_LARGE: "The file is larger than 10GB.",
};

function ReattachPicker({
  onFileSelected,
}: {
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="reattach-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        Select file
      </Button>
    </div>
  );
}

export function VideoStudioView({
  publicId,
  initialVideo,
}: {
  publicId: string;
  initialVideo: VideoResponse;
}) {
  const router = useRouter();
  const { addFile, start, clear, getUpload } = useUpload();
  const { video, setVideo } = useVideoStatus(publicId, initialVideo);
  const upload = getUpload(publicId);
  const [reattachError, setReattachError] = useState<string | null>(null);

  // The video returned by upload-completion (`uploaded`) is injected once, which starts the
  // status polling (adjusting state while rendering, not in an effect).
  const [syncedVideo, setSyncedVideo] = useState<VideoResponse | undefined>();
  if (upload?.video && upload.video !== syncedVideo) {
    setSyncedVideo(upload.video);
    setVideo(upload.video);
  }

  const errorCode = upload?.errorCode;
  useEffect(() => {
    if (errorCode === "UNAUTHORIZED") {
      router.replace("/login");
      return;
    }
    if (errorCode !== "INVALID_VIDEO_STATE") return;

    // The draft is no longer where the upload expected it: show whatever it is now.
    let cancelled = false;
    void fetch(`/api/videos/${publicId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((current: VideoResponse | null) => {
        if (!cancelled && current) setVideo(current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [errorCode, publicId, router, setVideo]);

  // Media URLs are fetched once, when the video is (or becomes) ready; undefined = loading.
  const ready = video.processingStatus === "ready";
  const [media, setMedia] = useState<MediaState | undefined>();
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    void fetch(`/api/videos/${publicId}/media-urls`, { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setMedia({ status: "error" });
          return;
        }
        const urls = (await response.json()) as MediaUrlsResponse;
        if (!cancelled) setMedia({ status: "ready", urls });
      })
      .catch(() => {
        if (!cancelled) setMedia({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, publicId, router]);

  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );

  function handleReattach(file: File) {
    setReattachError(null);
    clear();
    try {
      addFile(file);
    } catch (error) {
      setReattachError(
        error instanceof Error
          ? error.message
          : "This file cannot be uploaded.",
      );
      return;
    }
    void start(publicId);
  }

  const awaiting = video.processingStatus === "awaiting_upload";
  const uploading =
    awaiting &&
    (upload?.phase === "uploading" || upload?.phase === "completing");
  const uploadFailed = awaiting && upload?.phase === "error";
  const interrupted = awaiting && !upload;
  const inProgress = video.processingStatus !== "awaiting_upload" && !ready;

  const filename = upload?.fileName || video.filename;
  const uploadMessage = uploadFailed
    ? (UPLOAD_ERROR_COPY[upload?.errorCode ?? ""] ??
      upload?.error ??
      "The upload failed.")
    : null;

  return (
    <div className="flex flex-col gap-6 px-6 pb-6 pt-8">
      <h1 className="text-h1 text-foreground">Video details</h1>
      <Card className="gap-6 p-8">
        {uploading ? (
          <UploadProgressPanel
            filename={filename}
            percent={upload?.progress ?? 0}
            status={<VideoStatusBadge copy="Uploading" />}
          />
        ) : null}

        {interrupted || uploadFailed ? (
          <div className="flex flex-col gap-3 border-b border-border pb-4">
            <p
              role={uploadFailed ? "alert" : undefined}
              className="text-body-md text-foreground"
            >
              {uploadMessage ??
                "Envio interrompido — selecione o arquivo novamente"}
            </p>
            <ReattachPicker onFileSelected={handleReattach} />
            {reattachError ? (
              <p role="alert" className="text-body-md text-destructive-text">
                {reattachError}
              </p>
            ) : null}
          </div>
        ) : null}

        {inProgress ? (
          <div className="flex flex-col gap-3 border-b border-border pb-4">
            <ProcessingStatus
              processingStatus={video.processingStatus}
              copy={
                video.processingStatus === "failed" && video.failureReason
                  ? failureReasonCopy(video.failureReason)
                  : processingStatusCopy(video.processingStatus)
              }
            />
            {video.processingStatus === "failed" ? (
              <Link
                href="/studio/upload"
                className="text-body-md text-link underline-offset-4 hover:underline"
              >
                Upload a new video
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-start gap-16">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <SectionHeader
              title="Thumbnail"
              description="Select or upload a picture that shows what's in your video."
            />
            <ThumbUpload
              className="w-[266px]"
              thumbnailUrl={video.thumbnailUrl}
              duration={
                video.durationMs === null
                  ? undefined
                  : formatDuration(video.durationMs)
              }
            />
          </div>
          <VideoDetailsCard
            className="w-[328px] shrink-0"
            videoUrl={origin ? publicVideoUrl(origin, publicId) : ""}
            filename={video.filename}
            quality={qualityLabel(video.width, video.height)}
            duration={formatDuration(video.durationMs)}
            src={
              ready && media?.status === "ready" ? media.urls.streamUrl : null
            }
            poster={video.thumbnailUrl}
            playerMessage={
              ready && media?.status === "error"
                ? "The video could not be loaded."
                : null
            }
            downloadSlot={
              ready ? (
                media?.status === "ready" ? (
                  <Button asChild variant="secondary">
                    <a href={media.urls.downloadUrl}>
                      <DownloadIcon aria-hidden="true" />
                      Download
                    </a>
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" disabled>
                    <DownloadIcon aria-hidden="true" />
                    Download
                  </Button>
                )
              ) : undefined
            }
          />
        </div>

        {ready ? (
          <div className="border-t border-border pt-4">
            <ProcessingStatus
              processingStatus="ready"
              copy={processingStatusCopy("ready")}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
