// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SideNavItem } from "../side-nav-item";

describe("SideNavItem", () => {
  it("renders a link to href with the label", () => {
    render(<SideNavItem href="/studio/upload" label="Upload" />);
    expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute(
      "href",
      "/studio/upload",
    );
  });

  it("marks the active item with aria-current=page", () => {
    render(<SideNavItem href="/studio" label="Your videos" active />);
    expect(screen.getByRole("link", { name: "Your videos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not set aria-current when inactive", () => {
    render(<SideNavItem href="/studio" label="Your videos" />);
    expect(screen.getByRole("link", { name: "Your videos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders the disabled variant without a navigable link", () => {
    render(<SideNavItem href="/liked" label="Liked videos" disabled />);
    expect(screen.queryByRole("link")).toBeNull();
    const el = screen.getByText("Liked videos").closest("[data-slot='side-nav-item']");
    expect(el).toHaveAttribute("aria-disabled", "true");
    expect(el).not.toHaveAttribute("href");
  });
});
