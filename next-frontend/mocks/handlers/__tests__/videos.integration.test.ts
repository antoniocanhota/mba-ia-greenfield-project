import { describe, it, expect } from "vitest";

import type {
  MediaUrlsResponse,
  SignUploadResponse,
  VideoResponse,
} from "@/lib/api/contracts";
import { env } from "@/lib/env";
import { E2E_STORAGE_ORIGIN } from "@/mocks/storage-origin";

const AUTH = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

const call = (
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
) =>
  fetch(`${env.API_URL}${path}`, {
    method: init.method ?? "GET",
    headers:
      init.auth === false ? { "Content-Type": "application/json" } : AUTH,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

const createDraft = async (filename = "clip.mp4", sizeBytes = 2048) => {
  const res = await call("/videos", {
    method: "POST",
    body: { filename, sizeBytes, contentType: "video/mp4" },
  });
  return { res, video: (await res.json()) as VideoResponse };
};

describe("videos MSW handlers", () => {
  describe("draft lifecycle (in-memory store)", () => {
    it("hands out vid00000001 for the first draft of every test", async () => {
      const { res, video } = await createDraft();

      expect(res.status).toBe(201);
      expect(video.publicId).toBe("vid00000001");
      expect(video.publicId).toHaveLength(11);
    });

    it("restarts the counter after resetVideoStore() (previous test also created a draft)", async () => {
      const { video } = await createDraft();

      expect(video.publicId).toBe("vid00000001");
    });

    it("increments the counter within a test", async () => {
      await createDraft();
      const { video } = await createDraft();

      expect(video.publicId).toBe("vid00000002");
    });

    it("reads a draft as awaiting_upload and as uploaded after upload-completion", async () => {
      const { video } = await createDraft("my-video.mp4", 4096);

      const before = (await (
        await call(`/videos/${video.publicId}`)
      ).json()) as VideoResponse;
      expect(before).toMatchObject({
        publicId: video.publicId,
        filename: "my-video.mp4",
        processingStatus: "awaiting_upload",
        sizeBytes: null,
      });

      const completion = await call(
        `/videos/${video.publicId}/upload-completion`,
        {
          method: "POST",
        },
      );
      expect(completion.status).toBe(200);
      expect(
        ((await completion.json()) as VideoResponse).processingStatus,
      ).toBe("uploaded");

      const after = (await (
        await call(`/videos/${video.publicId}`)
      ).json()) as VideoResponse;
      expect(after).toMatchObject({
        processingStatus: "uploaded",
        sizeBytes: 4096,
      });
    });

    it("answers the default awaiting_upload fixture for an unknown, non-reserved id", async () => {
      const res = await call("/videos/unknownVid1");

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        publicId: "unknownVid1",
        processingStatus: "awaiting_upload",
      });
    });

    it("answers 409 VIDEO_NOT_READY on media-urls for a draft", async () => {
      const { video } = await createDraft();

      const res = await call(`/videos/${video.publicId}/media-urls`);

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_READY" });
    });
  });

  describe("reserved triggers", () => {
    it("missingVid1 answers 404 VIDEO_NOT_FOUND on every videos/{publicId} route", async () => {
      const routes: [string, string][] = [
        ["GET", "/videos/missingVid1"],
        ["POST", "/videos/missingVid1/upload-signatures"],
        ["POST", "/videos/missingVid1/upload-completion"],
        ["GET", "/videos/missingVid1/media-urls"],
      ];

      for (const [method, path] of routes) {
        const res = await call(path, {
          method,
          body: method === "POST" ? { method: "POST", key: "k" } : undefined,
        });
        expect(res.status, path).toBe(404);
        expect(await res.json(), path).toMatchObject({
          error: "VIDEO_NOT_FOUND",
        });
      }
    });

    it("failedVid01 is failed with not_a_video", async () => {
      const video = (await (
        await call("/videos/failedVid01")
      ).json()) as VideoResponse;

      expect(video).toMatchObject({
        processingStatus: "failed",
        failureReason: "not_a_video",
      });
    });

    it("procVid0001 is processing", async () => {
      const video = (await (
        await call("/videos/procVid0001")
      ).json()) as VideoResponse;

      expect(video.processingStatus).toBe("processing");
    });

    it("readyVid001 is ready with metadata, thumbnail and media urls", async () => {
      const video = (await (
        await call("/videos/readyVid001")
      ).json()) as VideoResponse;
      expect(video).toMatchObject({
        processingStatus: "ready",
        failureReason: null,
        width: 1920,
        height: 1080,
      });
      expect(video.durationMs).toBeGreaterThan(0);
      expect(video.thumbnailUrl).toBe(
        `${E2E_STORAGE_ORIGIN}/thumbnails/readyVid001.jpg`,
      );

      const urls = (await (
        await call("/videos/readyVid001/media-urls")
      ).json()) as MediaUrlsResponse;
      expect(
        urls.streamUrl.startsWith(`${E2E_STORAGE_ORIGIN}/videos/readyVid001/`),
      ).toBe(true);
      expect(urls.downloadUrl).toContain(
        "response-content-disposition=attachment",
      );
    });

    it("keeps the triggers stateless: upload-completion does not move them", async () => {
      const completion = await call("/videos/procVid0001/upload-completion", {
        method: "POST",
      });
      const failed = await call("/videos/failedVid01/upload-completion", {
        method: "POST",
      });

      expect(
        ((await completion.json()) as VideoResponse).processingStatus,
      ).toBe("processing");
      expect(failed.status).toBe(409);
    });

    it("too-large.mp4 answers 400 VALIDATION_ERROR on POST /videos without creating a draft", async () => {
      const { res } = await createDraft("too-large.mp4");
      expect(res.status).toBe(400);

      const { video } = await createDraft();
      expect(video.publicId).toBe("vid00000001");
    });
  });

  describe("upload-signatures", () => {
    const sign = async (body: object) => {
      const res = await call("/videos/vid00000001/upload-signatures", {
        method: "POST",
        body,
      });
      return { res, json: (await res.json()) as SignUploadResponse };
    };

    it("returns the draft key and a storage-origin url for CreateMultipartUpload", async () => {
      const { res, json } = await sign({ method: "POST", key: "client-key" });

      expect(res.status).toBe(201);
      expect(json.key).toBe("videos/vid00000001/original");
      expect(new URL(json.url).origin).toBe(E2E_STORAGE_ORIGIN);
      expect(new URL(json.url).pathname).toBe("/videos/vid00000001/original");
    });

    it("signs an UploadPart on the storage origin with uploadId and partNumber, without a key", async () => {
      const { json } = await sign({
        method: "PUT",
        key: "k",
        uploadId: "up-1",
        partNumber: 3,
      });

      const url = new URL(json.url);
      expect(url.origin).toBe(E2E_STORAGE_ORIGIN);
      expect(url.searchParams.get("uploadId")).toBe("up-1");
      expect(url.searchParams.get("partNumber")).toBe("3");
      expect(json.key).toBeUndefined();
    });
  });

  it("answers 401 UNAUTHORIZED on every endpoint when the Bearer token is missing", async () => {
    const routes: [string, string][] = [
      ["POST", "/videos"],
      ["GET", "/videos/vid00000001"],
      ["POST", "/videos/vid00000001/upload-signatures"],
      ["POST", "/videos/vid00000001/upload-completion"],
      ["GET", "/videos/vid00000001/media-urls"],
    ];

    for (const [method, path] of routes) {
      const res = await call(path, {
        method,
        auth: false,
        body: method === "POST" ? {} : undefined,
      });
      expect(res.status, path).toBe(401);
    }
  });
});
