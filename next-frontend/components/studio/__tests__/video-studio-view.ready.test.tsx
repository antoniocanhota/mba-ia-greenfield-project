// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VideoStudioView } from "@/components/studio/video-studio-view";
import type { MediaUrlsResponse, VideoResponse } from "@/lib/api/contracts";
import { formatDuration, qualityLabel } from "@/lib/videos/format";
import { buildMediaUrls, buildVideo } from "@/mocks/factories/videos";

const PUBLIC_ID = "readyVid001";

const { replaceMock, router } = vi.hoisted(() => {
  const replaceMock = vi.fn();
  // Same identity on every render, like the real app router.
  return { replaceMock, router: { replace: replaceMock, push: vi.fn() } };
});

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/components/studio/upload-provider", () => ({
  useUpload: () => ({
    addFile: vi.fn(),
    start: vi.fn(),
    clear: vi.fn(),
    getUpload: () => undefined,
  }),
}));

const fetchMock = vi.fn<typeof fetch>();
const MEDIA_URL = `/api/videos/${PUBLIC_ID}/media-urls`;
const STATUS_URL = `/api/videos/${PUBLIC_ID}`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const readyVideo = (overrides: Partial<VideoResponse> = {}) =>
  buildVideo({
    publicId: PUBLIC_ID,
    filename: "my-video.mp4",
    processingStatus: "ready",
    durationMs: 83_000,
    width: 1920,
    height: 1080,
    sizeBytes: 52_428_800,
    thumbnailUrl: "https://storage.test/thumbnails/readyVid001.jpg",
    ...overrides,
  });

const mediaCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url === MEDIA_URL);

function serve(
  media: () => Response | Promise<Response>,
  poll?: () => Response,
) {
  fetchMock.mockImplementation(async (input) => {
    if (input === MEDIA_URL) return media();
    if (input === STATUS_URL && poll) return poll();
    throw new Error(`unexpected fetch ${String(input)}`);
  });
}

beforeEach(() => {
  replaceMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("<VideoStudioView /> ready", () => {
  it("fetches the media URLs once and feeds the player and the download button", async () => {
    const media: MediaUrlsResponse = buildMediaUrls();
    let release!: (response: Response) => void;
    serve(() => new Promise<Response>((resolve) => (release = resolve)));
    const video = readyVideo();
    const { container } = render(
      <VideoStudioView publicId={PUBLIC_ID} initialVideo={video} />,
    );

    // Before the URLs arrive: poster only, download disabled.
    const player = container.querySelector("video")!;
    expect(player).toHaveAttribute("controls");
    expect(player).toHaveAttribute("poster", video.thumbnailUrl);
    expect(player).not.toHaveAttribute("src");
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();

    await act(async () => {
      release(json(media));
    });

    await waitFor(() =>
      expect(container.querySelector("video")).toHaveAttribute(
        "src",
        media.streamUrl,
      ),
    );
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      media.downloadUrl,
    );
    expect(mediaCalls()).toHaveLength(1);
  });

  it("keeps the download disabled and the player without src on a 409 VIDEO_NOT_READY", async () => {
    serve(() =>
      json(
        { statusCode: 409, error: "VIDEO_NOT_READY", message: "not ready" },
        409,
      ),
    );
    const { container } = render(
      <VideoStudioView publicId={PUBLIC_ID} initialVideo={readyVideo()} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The video could not be loaded.",
    );
    expect(container.querySelector("video")).not.toHaveAttribute("src");
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("keeps the download disabled when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    render(
      <VideoStudioView publicId={PUBLIC_ID} initialVideo={readyVideo()} />,
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });

  it("redirects to /login on a 401", async () => {
    serve(() =>
      json({ statusCode: 401, error: "UNAUTHORIZED", message: "x" }, 401),
    );
    render(
      <VideoStudioView publicId={PUBLIC_ID} initialVideo={readyVideo()} />,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });

  it("fetches the media URLs when the polling reaches ready", async () => {
    vi.useFakeTimers();
    serve(
      () => json(buildMediaUrls()),
      () => json(readyVideo()),
    );
    const { container } = render(
      <VideoStudioView
        publicId={PUBLIC_ID}
        initialVideo={readyVideo({ processingStatus: "processing" })}
      />,
    );

    expect(mediaCalls()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(3_000));

    expect(mediaCalls()).toHaveLength(1);
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      buildMediaUrls().streamUrl,
    );
    expect(screen.getByRole("link", { name: "Download" })).toBeInTheDocument();

    // Ready is terminal: no further polling and no second media fetch.
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(mediaCalls()).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === STATUS_URL),
    ).toHaveLength(1);
  });

  it("shows the formatted duration, quality, filename and thumbnail", async () => {
    serve(() => json(buildMediaUrls()));
    const video = readyVideo();
    render(<VideoStudioView publicId={PUBLIC_ID} initialVideo={video} />);

    expect(
      screen.getAllByText(formatDuration(video.durationMs)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(qualityLabel(video.width, video.height)),
    ).toBeInTheDocument();
    expect(screen.getAllByText("my-video.mp4").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(/ready/i);
    await waitFor(() => expect(mediaCalls()).toHaveLength(1));
  });
});
