"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { UploadIcon } from "@/components/icons/upload-icon"

type UploadDropzoneProps = {
  onFileSelected: (file: File) => void
  loading?: boolean
  error?: string | null
  className?: string
}

function UploadDropzone({
  onFileSelected,
  loading = false,
  error,
  className,
}: UploadDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!loading) setDragOver(true)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    if (loading) return
    const file = event.dataTransfer.files?.[0]
    if (file) onFileSelected(file)
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onFileSelected(file)
    event.target.value = ""
  }

  return (
    <div
      data-slot="upload-dropzone"
      data-drag-over={dragOver}
      aria-busy={loading}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center gap-6 rounded-[var(--radius-2)] border border-solid border-border bg-card px-6 pt-16 pb-10 text-center transition-colors",
        dragOver && "border-primary bg-muted/40",
        loading && "opacity-70",
        className
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          data-slot="upload-dropzone-spinner"
          className="size-12 animate-spin rounded-full border-4 border-muted border-t-primary"
        />
      ) : (
        <span className="flex items-center justify-center rounded-full bg-background p-10">
          <UploadIcon className="size-12 text-foreground" />
        </span>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-h2 text-foreground">
          Drag and drop a video file to upload
        </p>
        <p className="text-body-md text-muted-foreground">
          Your videos will be private until you publish them.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="upload-dropzone-input"
        disabled={loading}
        onChange={handleInputChange}
      />
      <Button
        type="button"
        size="sm"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        Select file
      </Button>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-body-md text-destructive-text">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { UploadDropzone }
