import * as React from "react"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { VideoFileIcon } from "@/components/icons/video-file-icon"

type UploadProgressPanelProps = {
  filename: string
  percent: number
  status?: React.ReactNode
  className?: string
}

function UploadProgressPanel({
  filename,
  percent,
  status,
  className,
}: UploadProgressPanelProps) {
  const value = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <div
      data-slot="upload-progress-panel"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-center gap-3">
        <VideoFileIcon className="size-8 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-label-md text-foreground">
            {filename}
          </span>
          <span
            data-slot="upload-progress-text"
            className="text-caption text-muted-foreground"
          >
            Uploading... {value}%
          </span>
        </div>
        {status ? (
          <div data-slot="upload-progress-status">{status}</div>
        ) : null}
      </div>
      <Progress value={value} aria-label="Upload progress" />
    </div>
  )
}

export { UploadProgressPanel }
