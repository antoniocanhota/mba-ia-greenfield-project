"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { CopyIcon } from "@/components/icons/copy-icon"
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
      <CopyIcon />
    </IconButton>
  )
}

export { CopyLinkButton }
