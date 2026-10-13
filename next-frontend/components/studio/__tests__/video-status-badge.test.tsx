// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { VideoStatusBadge } from "../video-status-badge";

describe("VideoStatusBadge", () => {
  it("renders the copy received via prop", () => {
    render(<VideoStatusBadge copy="Uploading" />);
    const el = screen.getByText("Uploading");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("data-slot", "video-status-badge");
  });
});
