"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { VideoResponse } from "@/lib/api/contracts";

const POLL_INTERVAL_MS = 3000;

function isInFlight(video: VideoResponse): boolean {
  return (
    video.processingStatus === "uploaded" ||
    video.processingStatus === "processing"
  );
}

export function useVideoStatus(publicId: string, initialVideo: VideoResponse) {
  const router = useRouter();
  const [video, setVideo] = useState<VideoResponse>(initialVideo);
  const polling = isInFlight(video);

  useEffect(() => {
    if (!polling) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // The next request is scheduled only after the previous one settles, so a
    // response slower than the interval never overlaps another request.
    const schedule = () => {
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    const tick = async () => {
      try {
        const response = await fetch(`/api/videos/${publicId}`, {
          cache: "no-store",
        });
        if (cancelled) return;

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.ok) {
          const next = (await response.json()) as VideoResponse;
          if (cancelled) return;
          setVideo(next);
          if (!isInFlight(next)) return;
        }
      } catch {
        if (cancelled) return;
      }
      schedule();
    };

    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [polling, publicId, router]);

  return { video, setVideo };
}
