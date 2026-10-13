import * as React from "react"

import { cn } from "@/lib/utils"

type ThumbUploadProps = {
  thumbnailUrl?: string | null
  alt?: string
  className?: string
}

function ThumbUpload({
  thumbnailUrl,
  alt = "Video thumbnail",
  className,
}: ThumbUploadProps) {
  const base = "aspect-video w-full overflow-hidden rounded-[var(--radius-3)]"

  if (!thumbnailUrl) {
    return (
      <div
        data-slot="thumb-upload"
        data-state="skeleton"
        aria-hidden="true"
        className={cn(base, "animate-pulse bg-muted", className)}
      />
    )
  }

  return (
    <div
      data-slot="thumb-upload"
      data-state="image"
      className={cn(base, "bg-muted", className)}
    >
      {/* Public-read storage URL (TD-09); not served through next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbnailUrl} alt={alt} className="size-full object-cover" />
    </div>
  )
}

export { ThumbUpload }
