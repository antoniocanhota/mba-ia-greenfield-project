// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { UploadDropzone } from "../upload-dropzone";

const file = new File(["x"], "clip.mp4", { type: "video/mp4" });

describe("UploadDropzone", () => {
  it("renders the singular copy and the select button", () => {
    render(<UploadDropzone onFileSelected={vi.fn()} />);
    expect(screen.getByText("Drag and drop a video file to upload")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select file" })).toBeEnabled();
  });

  it("calls onFileSelected once when a file is chosen in the picker", async () => {
    const user = userEvent.setup();
    const onFileSelected = vi.fn();
    render(<UploadDropzone onFileSelected={onFileSelected} />);
    await user.upload(screen.getByTestId("upload-dropzone-input"), file);
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("calls onFileSelected once when a file is dropped", () => {
    const onFileSelected = vi.fn();
    const { container } = render(<UploadDropzone onFileSelected={onFileSelected} />);
    const zone = container.querySelector('[data-slot="upload-dropzone"]')!;
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("highlights on drag-over and clears on drag-leave", () => {
    const { container } = render(<UploadDropzone onFileSelected={vi.fn()} />);
    const zone = container.querySelector('[data-slot="upload-dropzone"]')!;
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });

  it("renders the inline error as an alert", () => {
    render(<UploadDropzone onFileSelected={vi.fn()} error="File is too large" />);
    expect(screen.getByRole("alert")).toHaveTextContent("File is too large");
  });

  it("is disabled while loading and ignores drops", () => {
    const onFileSelected = vi.fn();
    const { container } = render(<UploadDropzone onFileSelected={onFileSelected} loading />);
    const zone = container.querySelector('[data-slot="upload-dropzone"]')!;
    expect(screen.getByRole("button", { name: "Select file" })).toBeDisabled();
    expect(zone).toHaveAttribute("aria-busy", "true");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFileSelected).not.toHaveBeenCalled();
  });
});
