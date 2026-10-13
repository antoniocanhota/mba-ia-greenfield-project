// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Progress } from "../progress";

describe("Progress", () => {
  it("renders with role=progressbar and data-slot=progress", () => {
    render(<Progress value={84} />);
    const el = screen.getByRole("progressbar");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("data-slot", "progress");
  });

  it("exposes the determinate value via aria-valuenow", () => {
    render(<Progress value={84} />);
    const el = screen.getByRole("progressbar");
    expect(el).toHaveAttribute("aria-valuenow", "84");
    expect(el).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders the indicator offset proportionally to the value", () => {
    const { container } = render(<Progress value={84} />);
    const indicator = container.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toHaveStyle({ transform: "translateX(-16%)" });
  });

  it("is indeterminate when no value is given", () => {
    render(<Progress />);
    const el = screen.getByRole("progressbar");
    expect(el).not.toHaveAttribute("aria-valuenow");
    expect(el).toHaveAttribute("data-state", "indeterminate");
  });
});
