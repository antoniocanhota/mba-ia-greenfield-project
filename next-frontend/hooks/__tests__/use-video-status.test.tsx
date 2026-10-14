// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVideoStatus } from "@/hooks/use-video-status";
import type { VideoResponse } from "@/lib/api/contracts";
import { buildVideo } from "@/mocks/factories/videos";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const jsonResponse = (video: VideoResponse, status = 200) =>
  new Response(JSON.stringify(video), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("useVideoStatus", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    replace.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["awaiting_upload", "ready", "failed"] as const)(
    "does not poll while %s",
    async (processingStatus) => {
      renderHook(() => useVideoStatus("abc", buildVideo({ processingStatus })));

      await act(() => vi.advanceTimersByTimeAsync(10_000));

      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["uploaded", "processing"] as const)(
    "polls every ~3s while %s and stops after ready",
    async (processingStatus) => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(buildVideo({ processingStatus })))
        .mockResolvedValueOnce(
          jsonResponse(buildVideo({ processingStatus: "ready" })),
        );
      const { result } = renderHook(() =>
        useVideoStatus("abc", buildVideo({ processingStatus })),
      );

      await act(() => vi.advanceTimersByTimeAsync(2_900));
      expect(fetchMock).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(200));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/videos/abc");

      await act(() => vi.advanceTimersByTimeAsync(3_000));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.video.processingStatus).toBe("ready");

      await act(() => vi.advanceTimersByTimeAsync(20_000));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("never overlaps requests when the response is slower than the interval", async () => {
    let resolveFirst!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(buildVideo({ processingStatus: "processing" })),
    );
    renderHook(() =>
      useVideoStatus("abc", buildVideo({ processingStatus: "processing" })),
    );

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(
        jsonResponse(buildVideo({ processingStatus: "processing" })),
      );
    });
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("starts polling when setVideo injects an uploaded video", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(buildVideo({ processingStatus: "ready" })),
    );
    const { result } = renderHook(() =>
      useVideoStatus(
        "abc",
        buildVideo({ processingStatus: "awaiting_upload" }),
      ),
    );

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(fetchMock).not.toHaveBeenCalled();

    act(() =>
      result.current.setVideo(buildVideo({ processingStatus: "uploaded" })),
    );
    await act(() => vi.advanceTimersByTimeAsync(3_000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.video.processingStatus).toBe("ready");
  });

  it("stops polling and redirects to /login on 401", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    renderHook(() =>
      useVideoStatus("abc", buildVideo({ processingStatus: "processing" })),
    );

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(replace).toHaveBeenCalledWith("/login");

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending timer on unmount", async () => {
    const { unmount } = renderHook(() =>
      useVideoStatus("abc", buildVideo({ processingStatus: "processing" })),
    );

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
