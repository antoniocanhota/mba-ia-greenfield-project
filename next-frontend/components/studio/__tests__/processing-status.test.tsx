// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ProcessingStatus } from "../processing-status";

describe("ProcessingStatus", () => {
  it.each([
    ["uploaded", "Upload received"],
    ["processing", "Processing video"],
    ["ready", "Video ready"],
    ["failed", "Processing failed"],
  ] as const)("renders the copy received for %s", (status, copy) => {
    render(<ProcessingStatus processingStatus={status} copy={copy} />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent(copy);
    expect(el).toHaveAttribute("data-status", status);
  });
});
