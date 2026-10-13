import * as React from "react"

import { cn } from "@/lib/utils"

type VideoPlayerProps = {
  src?: string | null
  poster?: string | null
  className?: string
}

function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  const base = "aspect-video w-full overflow-hidden rounded-[var(--radius-3)] bg-black"

  if (!src) {
    return (
      <div
        data-slot="video-player"
        data-state="placeholder"
        className={cn(base, "flex items-center justify-center", className)}
      >
        <span className="text-caption text-white/70">0:00</span>
      </div>
    )
  }

  return (
    <video
      data-slot="video-player"
      data-state="ready"
      controls
      preload="metadata"
      src={src}
      poster={poster ?? undefined}
      className={cn(base, className)}
    />
  )
}

export { VideoPlayer }
