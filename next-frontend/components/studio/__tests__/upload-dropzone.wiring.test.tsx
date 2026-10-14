// @vitest-environment jsdom
import Uppy from "@uppy/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { UploadProvider } from "@/components/studio/upload-provider";
import { VideoUploadDropzone } from "@/components/studio/video-upload-dropzone";
import { buildVideo } from "@/mocks/factories/videos";
import { server } from "@/mocks/server";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const TEN_GIB = 10 * 1024 ** 3;

// Real UploadProvider + real Uppy (so the restrictions are the real ones); only the network
// upload of the S3 plugin is stubbed.
let uploadSpy: MockInstance<typeof Uppy.prototype.upload>;

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  uploadSpy = vi.spyOn(Uppy.prototype, "upload").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function envelope(statusCode: number, error: string, message: string) {
  return { statusCode, error, message, code: null };
}

function renderDropzone() {
  const user = userEvent.setup({ applyAccept: false });
  render(
    <UploadProvider>
      <VideoUploadDropzone />
    </UploadProvider>,
  );
  const input = screen.getByTestId("upload-dropzone-input");
  return { user, input };
}

const videoFile = (name = "my-video.mp4") =>
  new File(["video-bytes"], name, { type: "video/mp4" });

describe("<VideoUploadDropzone /> wiring", () => {
  it("creates the draft with a typed payload, starts the upload and navigates", async () => {
    const received: Record<string, unknown>[] = [];
    server.use(
      http.post("/api/videos", async ({ request }) => {
        received.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(buildVideo({ publicId: "vidABC12345" }), {
          status: 201,
        });
      }),
    );
    const { user, input } = renderDropzone();

    await user.upload(input, videoFile());

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/studio/videos/vidABC12345"),
    );
    expect(received).toEqual([
      {
        filename: "my-video.mp4",
        sizeBytes: "video-bytes".length,
        contentType: "video/mp4",
      },
    ]);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an inline error and does not call the BFF for a non-video file", async () => {
    const calls = vi.fn();
    server.use(
      http.post("/api/videos", () => {
        calls();
        return HttpResponse.json(buildVideo(), { status: 201 });
      }),
    );
    const { user, input } = renderDropzone();

    await user.upload(
      input,
      new File(["x"], "notes.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(calls).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows an inline error and does not call the BFF above 10 GiB", async () => {
    const calls = vi.fn();
    server.use(
      http.post("/api/videos", () => {
        calls();
        return HttpResponse.json(buildVideo(), { status: 201 });
      }),
    );
    const { user, input } = renderDropzone();
    const huge = videoFile("huge.mp4");
    Object.defineProperty(huge, "size", { value: TEN_GIB + 1 });

    await user.upload(input, huge);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(calls).not.toHaveBeenCalled();
  });

  it("rejects a file name longer than 255 characters without calling the BFF", async () => {
    const calls = vi.fn();
    server.use(
      http.post("/api/videos", () => {
        calls();
        return HttpResponse.json(buildVideo(), { status: 201 });
      }),
    );
    const { user, input } = renderDropzone();

    await user.upload(input, videoFile(`${"a".repeat(252)}.mp4`));

    expect(await screen.findByRole("alert")).toHaveTextContent(/255/);
    expect(calls).not.toHaveBeenCalled();
  });

  it("maps a 400 to an inline error and accepts the same file again", async () => {
    let attempts = 0;
    server.use(
      http.post("/api/videos", () => {
        attempts += 1;
        return HttpResponse.json(
          envelope(400, "VALIDATION_ERROR", "sizeBytes is too large"),
          { status: 400 },
        );
      }),
    );
    const { user, input } = renderDropzone();
    const file = videoFile();

    await user.upload(input, file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sizeBytes is too large",
    );
    expect(screen.getByRole("button", { name: "Select file" })).toBeEnabled();
    expect(pushMock).not.toHaveBeenCalled();

    await user.upload(input, file);
    await waitFor(() => expect(attempts).toBe(2));
  });

  it("shows a generic inline error on a 5xx and allows retrying", async () => {
    server.use(
      http.post("/api/videos", () =>
        HttpResponse.json(envelope(500, "INTERNAL", "boom"), { status: 500 }),
      ),
    );
    const { user, input } = renderDropzone();

    await user.upload(input, videoFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the video draft",
    );
    expect(screen.getByRole("button", { name: "Select file" })).toBeEnabled();
  });

  it("redirects to /login on a 401", async () => {
    server.use(
      http.post("/api/videos", () =>
        HttpResponse.json(envelope(401, "UNAUTHORIZED", "Unauthorized"), {
          status: 401,
        }),
      ),
    );
    const { user, input } = renderDropzone();

    await user.upload(input, videoFile());

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables the dropzone while the draft is being created and ignores a second file", async () => {
    let posts = 0;
    server.use(
      http.post("/api/videos", async () => {
        posts += 1;
        await delay(150);
        return HttpResponse.json(buildVideo({ publicId: "vidSLOW1234" }), {
          status: 201,
        });
      }),
    );
    const { user, input } = renderDropzone();

    await user.upload(input, videoFile());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Select file" }),
      ).toBeDisabled(),
    );
    expect(input).toBeDisabled();

    await user.upload(input, videoFile("second.mp4"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
    expect(posts).toBe(1);
  });
});
