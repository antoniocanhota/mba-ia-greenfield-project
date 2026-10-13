import * as React from "react"

import { cn } from "@/lib/utils"

function VideoFileIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(className)}
      {...props}
    >
      <path
        d="M360-240h240q17 0 28.5-11.5T640-280v-80l80 60v-180l-80 60v-80q0-17-11.5-28.5T600-600H360q-17 0-28.5 11.5T320-560v280q0 17 11.5 28.5T360-240ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Z"
        fill="currentColor"
      />
    </svg>
  )
}

export { VideoFileIcon }
