// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { VideoPlayer } from "../video-player";

describe("VideoPlayer", () => {
  it("renders a <video> with native controls, src and poster", () => {
    const { container } = render(
      <VideoPlayer src="https://cdn.test/v.mp4" poster="https://cdn.test/p.jpg" />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("src", "https://cdn.test/v.mp4");
    expect(video).toHaveAttribute("poster", "https://cdn.test/p.jpg");
  });

  it.each([undefined, null, ""])("renders the placeholder without a <video> when src is %j", (src) => {
    const { container } = render(<VideoPlayer src={src} />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector('[data-state="placeholder"]')).not.toBeNull();
  });
});
