import * as React from "react"

import { cn } from "@/lib/utils"
import { ImageIcon } from "@/components/icons/image-icon"
import { PlayIcon } from "@/components/icons/play-icon"

type VideoPlayerProps = {
  src?: string | null
  poster?: string | null
  className?: string
}

function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  const base = "aspect-video w-full overflow-hidden bg-black"

  if (!src) {
    return (
      <div
        data-slot="video-player"
        data-state="placeholder"
        className={cn(
          base,
          "relative flex items-center justify-center rounded-t-[var(--radius-2)]",
          className
        )}
      >
        <ImageIcon className="absolute left-3 top-3 size-4 text-neutral-100" />
        <PlayIcon className="h-9 w-[27px] text-neutral-100" />
        <span className="absolute bottom-3 right-3 text-caption text-neutral-100">
          0:00
        </span>
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
      className={cn(base, "rounded-[var(--radius-3)]", className)}
    />
  )
}

export { VideoPlayer }
