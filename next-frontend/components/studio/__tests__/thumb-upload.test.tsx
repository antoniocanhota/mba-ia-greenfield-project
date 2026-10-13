// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ThumbUpload } from "../thumb-upload";

describe("ThumbUpload", () => {
  it("renders the image when thumbnailUrl exists", () => {
    render(<ThumbUpload thumbnailUrl="https://cdn.test/t.jpg" />);
    expect(screen.getByRole("img", { name: "Video thumbnail" })).toHaveAttribute(
      "src",
      "https://cdn.test/t.jpg",
    );
  });

  it.each([undefined, null])("renders a skeleton instead of an image when thumbnailUrl is %s", (value) => {
    const { container } = render(<ThumbUpload thumbnailUrl={value} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector('[data-state="skeleton"]')).not.toBeNull();
  });
});
