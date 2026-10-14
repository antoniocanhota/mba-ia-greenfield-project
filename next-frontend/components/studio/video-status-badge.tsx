import * as React from "react"

import { cn } from "@/lib/utils"

type VideoStatusBadgeProps = Omit<React.ComponentProps<"p">, "children"> & {
  copy: string
}

function VideoStatusBadge({ copy, className, ...props }: VideoStatusBadgeProps) {
  return (
    <p
      data-slot="video-status-badge"
      className={cn("text-caption text-link", className)}
      {...props}
    >
      {copy}
    </p>
  )
}

export { VideoStatusBadge }
