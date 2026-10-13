import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { CopyLinkButton } from "@/components/studio/copy-link-button"
import { VideoPlayer } from "@/components/studio/video-player"

type VideoDetailsCardProps = {
  videoUrl: string
  filename: string
  quality?: string | null
  duration?: string | null
  src?: string | null
  poster?: string | null
  downloadSlot?: React.ReactNode
  className?: string
}

const EMPTY = "—"

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body-md text-foreground break-words">{value}</dd>
    </div>
  )
}

function VideoDetailsCard({
  videoUrl,
  filename,
  quality,
  duration,
  src,
  poster,
  downloadSlot,
  className,
}: VideoDetailsCardProps) {
  return (
    <Card data-slot="video-details-card" className={cn(className)}>
      <CardContent className="flex flex-col gap-4">
        <VideoPlayer src={src} poster={poster} />
        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted-foreground">Video link</span>
          <div className="flex items-center gap-2">
            <span
              data-slot="video-details-link"
              className="min-w-0 flex-1 truncate text-body-md text-link"
            >
              {videoUrl}
            </span>
            <CopyLinkButton text={videoUrl} />
          </div>
        </div>
        {downloadSlot ? <div>{downloadSlot}</div> : null}
        <dl className="flex flex-col gap-3">
          <DetailRow label="Filename" value={filename} />
          <DetailRow label="Video quality" value={quality || EMPTY} />
          <DetailRow label="Duration" value={duration || EMPTY} />
        </dl>
      </CardContent>
    </Card>
  )
}

export { VideoDetailsCard }
