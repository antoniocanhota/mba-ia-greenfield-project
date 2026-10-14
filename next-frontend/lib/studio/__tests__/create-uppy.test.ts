// @vitest-environment jsdom
import type Uppy from "@uppy/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createUppy,
  getChunkSize,
  MAX_PARTS,
  MAX_VIDEO_BYTES,
  MIN_PART_BYTES,
} from "../create-uppy";

const GiB = 2 ** 30;

const fileOf = (name: string, type: string, size = 4) => {
  const file = new File(["x".repeat(4)], name, { type });
  // Uppy reads the size from the Blob; fake large sizes without allocating them.
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const add = (uppy: Uppy, file: File) =>
  uppy.addFile({ name: file.name, type: file.type, data: file });

describe("getChunkSize", () => {
  it("never goes below the 5 MiB S3 minimum part size", () => {
    expect(getChunkSize({ size: 1 })).toBe(MIN_PART_BYTES);
    expect(getChunkSize({ size: 10 * GiB })).toBe(MIN_PART_BYTES);
  });

  it("splits a 10 GiB file in at most 10000 parts of at least 5 MiB", () => {
    const chunk = getChunkSize({ size: MAX_VIDEO_BYTES });

    expect(chunk).toBeGreaterThanOrEqual(MIN_PART_BYTES);
    expect(Math.ceil(MAX_VIDEO_BYTES / chunk)).toBeLessThanOrEqual(MAX_PARTS);
  });

  it("keeps the part count under 10000 even for sizes above the restriction", () => {
    const size = 100 * GiB;

    expect(Math.ceil(size / getChunkSize({ size }))).toBeLessThanOrEqual(
      MAX_PARTS,
    );
  });
});

describe("createUppy restrictions", () => {
  it("accepts a video file", () => {
    const uppy = createUppy({ getPublicId: () => "abcdefghijk" });

    expect(() => add(uppy, fileOf("clip.mp4", "video/mp4"))).not.toThrow();
    expect(uppy.getFiles()).toHaveLength(1);
  });

  it("rejects a non-video file", () => {
    const uppy = createUppy({ getPublicId: () => "abcdefghijk" });

    expect(() => add(uppy, fileOf("notes.txt", "text/plain"))).toThrow();
    expect(uppy.getFiles()).toHaveLength(0);
  });

  it("rejects a file above 10 GiB and accepts exactly 10 GiB", () => {
    const uppy = createUppy({ getPublicId: () => "abcdefghijk" });

    expect(() =>
      add(uppy, fileOf("big.mp4", "video/mp4", MAX_VIDEO_BYTES + 1)),
    ).toThrow();
    expect(() =>
      add(uppy, fileOf("max.mp4", "video/mp4", MAX_VIDEO_BYTES)),
    ).not.toThrow();
  });

  it("rejects a second file", () => {
    const uppy = createUppy({ getPublicId: () => "abcdefghijk" });
    add(uppy, fileOf("one.mp4", "video/mp4"));

    expect(() => add(uppy, fileOf("two.mp4", "video/mp4"))).toThrow();
    expect(uppy.getFiles()).toHaveLength(1);
  });
});

describe("createUppy signRequest", () => {
  const fetchMock = vi.fn();

  type SignRequest = (request: Record<string, unknown>) => Promise<unknown>;

  const signRequestOf = (uppy: Uppy) =>
    (
      uppy.getPlugin("AwsS3") as unknown as {
        opts: { signRequest: SignRequest };
      }
    ).opts.signRequest;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the S3 operation to the upload-signatures route of the draft and returns { url, key }", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://storage/signed",
          key: "videos/abc/original",
        }),
        {
          status: 201,
        },
      ),
    );
    const uppy = createUppy({ getPublicId: () => "abcdefghijk" });

    const signed = await signRequestOf(uppy)({
      method: "PUT",
      key: "client-key",
      uploadId: "up-1",
      partNumber: 3,
      expiresIn: 600,
    });

    expect(signed).toEqual({
      url: "https://storage/signed",
      key: "videos/abc/original",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/videos/abcdefghijk/upload-signatures");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      method: "PUT",
      key: "client-key",
      uploadId: "up-1",
      partNumber: 3,
    });
  });

  it("resolves the publicId at sign time, not at creation time", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "u" }), { status: 201 }),
    );
    const draft: { id?: string } = {};
    const uppy = createUppy({ getPublicId: () => draft.id });
    draft.id = "latedraft01";

    await signRequestOf(uppy)({ method: "POST", key: "k" });

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "/api/videos/latedraft01/upload-signatures",
    );
  });

  it("fails when the BFF refuses to sign", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 409 }));
    const uppy = createUppy({ getPublicId: () => "abcdefghijk" });

    await expect(
      signRequestOf(uppy)({ method: "POST", key: "k" }),
    ).rejects.toThrow(/409/);
  });

  it("fails without calling the BFF when there is no draft yet", async () => {
    const uppy = createUppy({ getPublicId: () => undefined });

    await expect(
      signRequestOf(uppy)({ method: "POST", key: "k" }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
