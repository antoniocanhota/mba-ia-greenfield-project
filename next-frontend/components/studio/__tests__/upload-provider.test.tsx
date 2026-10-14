// @vitest-environment jsdom
import type Uppy from "@uppy/core";
import { UppyContext } from "@uppy/react";
import { act, render } from "@testing-library/react";
import { useContext, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VideoResponse } from "@/lib/api/contracts";
import { buildVideo } from "@/mocks/factories/videos";

import { UploadProvider, useUpload } from "../upload-provider";

const PUBLIC_ID = "abcdefghijk";

type Api = ReturnType<typeof useUpload>;
let api: Api;
let uppy: Uppy;

// Test consumer: hands the provider API and the Uppy instance (via UppyContext) to the test,
// which drives Uppy events the way the S3 plugin would.
function Probe() {
  const current = useUpload();
  const { uppy: instance } = useContext(UppyContext);
  useEffect(() => {
    api = current;
    uppy = instance as Uppy;
  });
  return null;
}

const mount = () =>
  render(
    <UploadProvider>
      <Probe />
    </UploadProvider>,
  );

const videoFile = () => new File(["x"], "my-video.mp4", { type: "video/mp4" });

const emit = (event: string, ...args: unknown[]) =>
  act(() => {
    (uppy as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
      event,
      ...args,
    );
  });

const progress = (bytesUploaded: number, bytesTotal: number) => ({
  bytesUploaded,
  bytesTotal,
});

const startUpload = async () => {
  vi.spyOn(uppy, "upload").mockResolvedValue(undefined);
  act(() => api.addFile(videoFile()));
  await act(async () => {
    await api.start(PUBLIC_ID);
  });
};

const flush = () => act(async () => {});

describe("UploadProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts as uploading at 0% with the picked file name", async () => {
    mount();

    await startUpload();

    expect(api.getUpload(PUBLIC_ID)).toMatchObject({
      fileName: "my-video.mp4",
      progress: 0,
      phase: "uploading",
    });
    expect(uppy.upload).toHaveBeenCalledTimes(1);
  });

  it("keeps no state for an unknown draft", () => {
    mount();

    expect(api.getUpload("other")).toBeUndefined();
  });

  it("updates the progress on upload-progress events", async () => {
    mount();
    await startUpload();

    emit("upload-progress", undefined, progress(25, 100));
    expect(api.getUpload(PUBLIC_ID)?.progress).toBe(25);

    emit("upload-progress", undefined, progress(84, 100));
    expect(api.getUpload(PUBLIC_ID)?.progress).toBe(84);
  });

  it("calls upload-completion once on upload-success and exposes the uploaded video", async () => {
    const uploaded: VideoResponse = buildVideo({
      publicId: PUBLIC_ID,
      processingStatus: "uploaded",
      sizeBytes: 4096,
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(uploaded), { status: 200 }),
    );
    mount();
    await startUpload();

    emit("upload-success", undefined, {});
    emit("upload-success", undefined, {});
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/videos/${PUBLIC_ID}/upload-completion`);
    expect(init.method).toBe("POST");
    expect(api.getUpload(PUBLIC_ID)).toMatchObject({
      phase: "completed",
      progress: 100,
      video: { processingStatus: "uploaded" },
    });
  });

  it("clears the Uppy file after completion so a new upload can start", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(buildVideo({ processingStatus: "uploaded" })),
        { status: 200 },
      ),
    );
    mount();
    await startUpload();
    expect(uppy.getFiles()).toHaveLength(1);

    emit("upload-success", undefined, {});
    await flush();

    expect(uppy.getFiles()).toHaveLength(0);
  });

  it.each([
    [409, "UPLOAD_INCOMPLETE"],
    [422, "FILE_TOO_LARGE"],
  ])(
    "turns a %i %s completion error into phase error with its errorCode",
    async (status, code) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: status,
            error: code,
            message: "upstream says no",
          }),
          { status },
        ),
      );
      mount();
      await startUpload();

      emit("upload-success", undefined, {});
      await flush();

      expect(api.getUpload(PUBLIC_ID)).toMatchObject({
        phase: "error",
        errorCode: code,
        error: "upstream says no",
      });
      expect(api.getUpload(PUBLIC_ID)?.video).toBeUndefined();
    },
  );

  it("turns a network failure on completion into phase error NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    mount();
    await startUpload();

    emit("upload-success", undefined, {});
    await flush();

    expect(api.getUpload(PUBLIC_ID)).toMatchObject({
      phase: "error",
      errorCode: "NETWORK_ERROR",
    });
  });

  it("turns an upload-error event into phase error without calling completion", async () => {
    mount();
    await startUpload();

    emit("upload-error", undefined, new Error("part 3 failed"));

    expect(api.getUpload(PUBLIC_ID)).toMatchObject({
      phase: "error",
      errorCode: "UPLOAD_FAILED",
      error: "part 3 failed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-video file, a second file and an oversized file before any BFF call", () => {
    mount();

    expect(() =>
      api.addFile(new File(["x"], "notes.txt", { type: "text/plain" })),
    ).toThrow();
    act(() => api.addFile(videoFile()));
    expect(() => api.addFile(videoFile())).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clear() drops the file from Uppy", () => {
    mount();
    act(() => api.addFile(videoFile()));

    act(() => api.clear());

    expect(uppy.getFiles()).toHaveLength(0);
  });

  it("keeps the upload state when a consumer unmounts and another mounts under the same provider", async () => {
    const { rerender } = render(
      <UploadProvider>
        <Probe />
      </UploadProvider>,
    );
    await startUpload();
    emit("upload-progress", undefined, progress(50, 100));

    rerender(
      <UploadProvider>
        <Probe key="another-route" />
      </UploadProvider>,
    );

    expect(api.getUpload(PUBLIC_ID)?.progress).toBe(50);
  });
});

describe("useUpload", () => {
  it("throws outside an UploadProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/UploadProvider/);
    spy.mockRestore();
  });
});
