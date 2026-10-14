// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UploadState } from "@/components/studio/upload-provider";
import { VideoStudioView } from "@/components/studio/video-studio-view";
import type { VideoResponse } from "@/lib/api/contracts";
import { failureReasonCopy, processingStatusCopy } from "@/lib/videos/format";
import { buildVideo } from "@/mocks/factories/videos";

const PUBLIC_ID = "vid00000001";

const { addFileMock, startMock, clearMock, replaceMock, uploadRef } =
  vi.hoisted(() => ({
    addFileMock: vi.fn(),
    startMock: vi.fn(),
    clearMock: vi.fn(),
    replaceMock: vi.fn(),
    uploadRef: { current: undefined as UploadState | undefined },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

// The provider is stubbed: its Uppy behavior is covered by upload-provider.test.tsx.
vi.mock("@/components/studio/upload-provider", () => ({
  useUpload: () => ({
    addFile: addFileMock,
    start: startMock,
    clear: clearMock,
    getUpload: () => uploadRef.current,
  }),
}));

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (video: VideoResponse) =>
  new Response(JSON.stringify(video), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const renderView = (video: Partial<VideoResponse> = {}) =>
  render(
    <VideoStudioView
      publicId={PUBLIC_ID}
      initialVideo={buildVideo({ publicId: PUBLIC_ID, ...video })}
    />,
  );

beforeEach(() => {
  uploadRef.current = undefined;
  addFileMock.mockReset();
  startMock.mockReset();
  clearMock.mockReset();
  replaceMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("<VideoStudioView /> upload in progress", () => {
  it("shows the active upload with the same percentage in text and bar", () => {
    uploadRef.current = {
      fileName: "my-video.mp4",
      progress: 42,
      phase: "uploading",
    };
    renderView();

    expect(
      screen.getByRole("heading", { name: "Video details" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("my-video.mp4").length).toBeGreaterThan(0);
    expect(screen.getByText("Uploading... 42%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByText("Uploading")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows 'Envio interrompido' without an active upload and re-attaches to the same draft", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderView();

    expect(
      screen.getByText("Envio interrompido — selecione o arquivo novamente"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    const file = new File(["x"], "my-video.mp4", { type: "video/mp4" });
    await user.upload(screen.getByTestId("reattach-input"), file);

    expect(addFileMock).toHaveBeenCalledWith(file);
    expect(startMock).toHaveBeenCalledWith(PUBLIC_ID);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the Uppy restriction message when the re-attached file is rejected", async () => {
    const user = userEvent.setup({ applyAccept: false });
    addFileMock.mockImplementation(() => {
      throw new Error("You can only upload: video/*");
    });
    renderView();

    await user.upload(
      screen.getByTestId("reattach-input"),
      new File(["x"], "notes.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You can only upload: video/*",
    );
    expect(startMock).not.toHaveBeenCalled();
  });

  it("starts polling with the video returned by upload-completion and swaps the label", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      jsonResponse(
        buildVideo({ publicId: PUBLIC_ID, processingStatus: "processing" }),
      ),
    );
    uploadRef.current = {
      fileName: "my-video.mp4",
      progress: 100,
      phase: "completed",
      video: buildVideo({ publicId: PUBLIC_ID, processingStatus: "uploaded" }),
    };
    renderView();

    expect(screen.getByRole("status")).toHaveTextContent(
      processingStatusCopy("uploaded"),
    );
    expect(screen.queryByText("Uploading")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Envio interrompido — selecione o arquivo novamente"),
    ).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3_000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/videos/${PUBLIC_ID}`);
    expect(screen.getByRole("status")).toHaveTextContent(
      processingStatusCopy("processing"),
    );
  });

  it("shows the failure reason copy and a link to /studio/upload, with no re-attach", () => {
    renderView({ processingStatus: "failed", failureReason: "not_a_video" });

    expect(
      screen.getByText(failureReasonCopy("not_a_video")),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload/i })).toHaveAttribute(
      "href",
      "/studio/upload",
    );
    expect(screen.queryByTestId("reattach-input")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Envio interrompido — selecione o arquivo novamente"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["UPLOAD_INCOMPLETE", /not fully uploaded/i],
    ["FILE_TOO_LARGE", /larger than 10GB/i],
  ])(
    "renders the %s message in the panel with the re-attach picker",
    (errorCode, message) => {
      uploadRef.current = {
        fileName: "my-video.mp4",
        progress: 100,
        phase: "error",
        errorCode,
        error: "server message",
      };
      renderView();

      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(screen.getByTestId("reattach-input")).toBeInTheDocument();
    },
  );

  it("reloads the current video on INVALID_VIDEO_STATE", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        buildVideo({
          publicId: PUBLIC_ID,
          processingStatus: "failed",
          failureReason: "processing_error",
        }),
      ),
    );
    uploadRef.current = {
      fileName: "my-video.mp4",
      progress: 100,
      phase: "error",
      errorCode: "INVALID_VIDEO_STATE",
      error: "invalid state",
    };
    renderView();

    expect(
      await screen.findByText(failureReasonCopy("processing_error")),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/videos/${PUBLIC_ID}`);
  });

  it("redirects to /login on UNAUTHORIZED", async () => {
    uploadRef.current = {
      fileName: "my-video.mp4",
      progress: 100,
      phase: "error",
      errorCode: "UNAUTHORIZED",
      error: "Unauthorized",
    };
    renderView();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });

  it("shows the video link as copyable text, not as a navigable link", async () => {
    renderView({ processingStatus: "processing" });

    const expected = `${window.location.origin}/v/${PUBLIC_ID}`;
    await waitFor(() =>
      expect(
        screen.getByText(expected, {
          selector: "[data-slot='video-details-link']",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: expected }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });
});
