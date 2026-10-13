// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/studio/upload",
}));

import { SideNav } from "../side-nav";

describe("SideNav", () => {
  it("renders the planned navigation items", () => {
    render(<SideNav />);
    for (const label of [
      "Home",
      "Subscriptions",
      "Your videos",
      "Liked videos",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "You" })).toBeInTheDocument();
  });

  it("renders links to future-phase routes as disabled", () => {
    render(<SideNav />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(4);
  });

  it("does not render a subscribed channels list", () => {
    render(<SideNav />);
    expect(screen.queryByText(/^Subscriptions$/)).toBeInTheDocument();
    expect(document.querySelector('[data-slot="subscriptions-channel-list"]')).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
