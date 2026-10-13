// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SectionHeader } from "../section-header";

describe("SectionHeader", () => {
  it("renders the title as a heading", () => {
    render(<SectionHeader title="Thumbnail" />);
    expect(
      screen.getByRole("heading", { name: "Thumbnail" }),
    ).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(
      <SectionHeader title="Thumbnail" description="Select or upload a picture" />,
    );
    expect(screen.getByText("Select or upload a picture")).toBeInTheDocument();
  });

  it("omits the description element when absent", () => {
    const { container } = render(<SectionHeader title="Thumbnail" />);
    expect(
      container.querySelector('[data-slot="section-header-description"]'),
    ).toBeNull();
  });

  it("exposes data-slot=section-header on the root and forwards props", () => {
    const { container } = render(
      <SectionHeader title="Thumbnail" data-testid="sh" />,
    );
    expect(container.firstElementChild).toHaveAttribute(
      "data-slot",
      "section-header",
    );
    expect(screen.getByTestId("sh")).toBeInTheDocument();
  });
});
