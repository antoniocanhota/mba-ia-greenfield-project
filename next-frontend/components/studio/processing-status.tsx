import * as React from "react"

import { cn } from "@/lib/utils"
import { CheckIcon } from "@/components/icons/check-icon"

type ProcessingStatusValue =
  | "awaiting_upload"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"

type ProcessingStatusProps = {
  processingStatus: ProcessingStatusValue
  copy: string
  className?: string
}

function ProcessingStatus({
  processingStatus,
  copy,
  className,
}: ProcessingStatusProps) {
  const inProgress =
    processingStatus === "uploaded" || processingStatus === "processing"

  return (
    <div
      data-slot="processing-status"
      data-status={processingStatus}
      role="status"
      className={cn(
        "flex items-center gap-2 text-caption",
        processingStatus === "failed"
          ? "text-destructive-text"
          : "text-muted-foreground",
        className
      )}
    >
      {inProgress ? (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : processingStatus === "ready" ? (
        <CheckIcon className="size-4 shrink-0" />
      ) : null}
      <span>{copy}</span>
    </div>
  )
}

export { ProcessingStatus }
export type { ProcessingStatusProps, ProcessingStatusValue }
