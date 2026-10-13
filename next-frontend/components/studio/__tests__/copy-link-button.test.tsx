// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { CopyLinkButton } from "../copy-link-button";

describe("CopyLinkButton", () => {
  it("exposes an accessible name", () => {
    render(<CopyLinkButton text="https://x.test/v/abc" />);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("copies the given text to the clipboard on click", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<CopyLinkButton text="https://x.test/v/abc" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("https://x.test/v/abc");
  });
});
