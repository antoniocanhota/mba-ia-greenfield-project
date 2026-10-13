// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { VideoDetailsCard } from "../video-details-card";

describe("VideoDetailsCard", () => {
  it("shows the filename, the link as text and the metadata", () => {
    render(
      <VideoDetailsCard
        videoUrl="https://x.test/v/abc123"
        filename="clip.mp4"
        quality="1080p HD"
        duration="1:05"
      />,
    );
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("https://x.test/v/abc123")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("1080p HD")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("renders an em dash for null metadata", () => {
    render(
      <VideoDetailsCard
        videoUrl="https://x.test/v/abc123"
        filename="clip.mp4"
        quality={null}
        duration={null}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("renders the download slot when provided", () => {
    render(
      <VideoDetailsCard
        videoUrl="https://x.test/v/abc123"
        filename="clip.mp4"
        downloadSlot={<button type="button">Download</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });
});
