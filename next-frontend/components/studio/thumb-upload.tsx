import * as React from "react"
import Image from "next/image"

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
  const base = "relative aspect-video w-full overflow-hidden rounded-[var(--radius-3)]"

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
      {/* Public-read storage URL (TD-09), host depends on the environment: served as-is, no optimizer. */}
      <Image
        src={thumbnailUrl}
        alt={alt}
        fill
        unoptimized
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  )
}

export { ThumbUpload }
