// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { UploadProgressPanel } from "../upload-progress-panel";

describe("UploadProgressPanel", () => {
  it("shows the filename and the same percentage in text and bar", () => {
    render(<UploadProgressPanel filename="clip.mp4" percent={84} />);
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("Uploading... 84%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "84");
  });

  it("rounds and clamps so text and bar never diverge", () => {
    const { rerender } = render(<UploadProgressPanel filename="a.mp4" percent={33.6} />);
    expect(screen.getByText("Uploading... 34%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "34");
    rerender(<UploadProgressPanel filename="a.mp4" percent={140} />);
    expect(screen.getByText("Uploading... 100%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders the status slot when provided", () => {
    render(<UploadProgressPanel filename="a.mp4" percent={10} status={<span>Uploading</span>} />);
    expect(screen.getByText("Uploading")).toBeInTheDocument();
  });
});
