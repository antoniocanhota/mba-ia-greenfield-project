"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"

type CopyLinkButtonProps = {
  text: string
  label?: string
  className?: string
}

function CopyLinkButton({
  text,
  label = "Copy link",
  className,
}: CopyLinkButtonProps) {
  async function handleClick() {
    await navigator.clipboard.writeText(text)
  }

  return (
    <IconButton
      aria-label={label}
      size="sm"
      className={cn(className)}
      onClick={handleClick}
    >
      <svg
        viewBox="0 -960 960 960"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Z"
          fill="currentColor"
        />
      </svg>
    </IconButton>
  )
}

export { CopyLinkButton }
