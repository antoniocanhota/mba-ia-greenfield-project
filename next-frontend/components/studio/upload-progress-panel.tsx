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
      className={cn("flex flex-col gap-2 border-b border-border", className)}
    >
      <div className="flex items-start gap-2">
        <VideoFileIcon className="size-6 shrink-0 text-foreground" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-md text-foreground">
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
