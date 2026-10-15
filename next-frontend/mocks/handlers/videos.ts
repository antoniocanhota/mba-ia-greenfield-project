/**
 * Upstream fake for the five /videos endpoints.
 *
 * Reserved trigger table — stateless, takes precedence over the store, and never collides
 * with the auth triggers (emails) nor with the counter ids (`vid` + 8 digits):
 *
 *   publicId `missingVid1` → 404 VIDEO_NOT_FOUND on every /videos/{publicId}/** route
 *   publicId `failedVid01` → `failed` video, failureReason `not_a_video`
 *   publicId `readyVid001` → `ready` video with metadata and thumbnailUrl (media-urls 200)
 *   publicId `procVid0001` → `processing` video
 *   filename `too-large.mp4` → 400 VALIDATION_ERROR on POST /videos
 *
 * Documented exception to "stateless triggers" (e2e-video-upload-fixtures/TD-02): videos
 * have a lifecycle, so POST /videos records a draft in an in-memory store keyed by
 * publicId; upload-completion moves it to `uploaded`. Unknown, non-reserved ids answer the
 * default `awaiting_upload` fixture ("Envio interrompido" scenario). `resetVideoStore()`
 * clears the store and the id counter (called from mocks/setup.ts after every test).
 */
import { http, HttpResponse } from "msw";

import type {
  ApiErrorEnvelope,
  SignUploadResponse,
  VideoResponse,
} from "@/lib/api/contracts";
import { buildMediaUrls, buildVideo } from "@/mocks/factories/videos";
import { E2E_STORAGE_ORIGIN } from "@/mocks/storage-origin";
import { env } from "@/lib/env";

const MISSING_ID = "missingVid1";
const FAILED_ID = "failedVid01";
const READY_ID = "readyVid001";
const PROCESSING_ID = "procVid0001";
const TOO_LARGE_FILENAME = "too-large.mp4";

interface StoredVideo {
  video: VideoResponse;
  declaredSizeBytes: number;
}

const store = new Map<string, StoredVideo>();
let counter = 0;

export function resetVideoStore() {
  store.clear();
  counter = 0;
}

const nextPublicId = () => `vid${String(++counter).padStart(8, "0")}`;

const envelope = (
  statusCode: number,
  error: string,
  message: ApiErrorEnvelope["message"],
): ApiErrorEnvelope => ({ statusCode, error, message });

const notFound = () =>
  HttpResponse.json(envelope(404, "VIDEO_NOT_FOUND", "Video not found"), {
    status: 404,
  });

const unauthorized = () =>
  HttpResponse.json(envelope(401, "UNAUTHORIZED", "Unauthorized"), {
    status: 401,
  });

// The real API rejects calls without a Bearer token; keeping that here makes the BFF tests
// prove the token is injected server-side.
const hasBearer = (request: Request) =>
  (request.headers.get("authorization") ?? "").startsWith("Bearer");

function reservedVideo(publicId: string): VideoResponse | undefined {
  switch (publicId) {
    case FAILED_ID:
      return buildVideo({
        publicId,
        processingStatus: "failed",
        failureReason: "not_a_video",
      });
    case READY_ID:
      return buildVideo({
        publicId,
        filename: "my-video.mp4",
        title: "my-video",
        processingStatus: "ready",
        durationMs: 83_000,
        width: 1920,
        height: 1080,
        sizeBytes: 52_428_800,
        thumbnailUrl: `${E2E_STORAGE_ORIGIN}/thumbnails/${publicId}.jpg`,
      });
    case PROCESSING_ID:
      return buildVideo({ publicId, processingStatus: "processing" });
    default:
      return undefined;
  }
}

const lookup = (publicId: string): VideoResponse =>
  reservedVideo(publicId) ??
  store.get(publicId)?.video ??
  buildVideo({ publicId });

// Mirrors the backend rule: filename without its last extension, or the whole
// filename when stripping leaves nothing. The frontend never imports backend code.
const titleFromFilename = (filename: string): string => {
  const stripped = filename.replace(/\.[^.]*$/, "");
  return stripped === "" ? filename : stripped;
};

interface CreateVideoBody {
  filename?: string;
  sizeBytes?: number;
}

interface SignUploadBody {
  method?: string;
  uploadId?: string;
  partNumber?: number;
}

export const handlers = [
  // POST /videos
  http.post(`${env.API_URL}/videos`, async ({ request }) => {
    if (!hasBearer(request)) return unauthorized();
    const body = (await request.json()) as CreateVideoBody;

    if (body.filename === TOO_LARGE_FILENAME) {
      return HttpResponse.json(
        envelope(400, "VALIDATION_ERROR", [
          "sizeBytes must not be greater than 10737418240",
        ]),
        { status: 400 },
      );
    }

    const publicId = nextPublicId();
    const filename = body.filename ?? "video.mp4";
    const video = buildVideo({
      publicId,
      filename,
      title: titleFromFilename(filename),
    });
    store.set(publicId, { video, declaredSizeBytes: body.sizeBytes ?? 0 });
    return HttpResponse.json<VideoResponse>(video, { status: 201 });
  }),

  // GET /videos/{publicId}
  http.get(`${env.API_URL}/videos/:publicId`, ({ request, params }) => {
    if (!hasBearer(request)) return unauthorized();
    const publicId = String(params.publicId);
    if (publicId === MISSING_ID) return notFound();
    return HttpResponse.json<VideoResponse>(lookup(publicId));
  }),

  // POST /videos/{publicId}/upload-signatures
  http.post(
    `${env.API_URL}/videos/:publicId/upload-signatures`,
    async ({ request, params }) => {
      if (!hasBearer(request)) return unauthorized();
      const publicId = String(params.publicId);
      if (publicId === MISSING_ID) return notFound();

      const body = (await request.json()) as SignUploadBody;
      const key = `videos/${publicId}/original`;
      const url = new URL(`/${key}`, E2E_STORAGE_ORIGIN);
      url.searchParams.set("X-Amz-Signature", "fake-signature");
      if (body.uploadId) url.searchParams.set("uploadId", body.uploadId);
      if (body.partNumber)
        url.searchParams.set("partNumber", String(body.partNumber));

      // The key is only returned when the multipart upload is created.
      const isCreate = body.method === "POST" && !body.uploadId;
      return HttpResponse.json<SignUploadResponse>(
        isCreate ? { url: url.toString(), key } : { url: url.toString() },
        { status: 201 },
      );
    },
  ),

  // POST /videos/{publicId}/upload-completion
  http.post(
    `${env.API_URL}/videos/:publicId/upload-completion`,
    ({ request, params }) => {
      if (!hasBearer(request)) return unauthorized();
      const publicId = String(params.publicId);
      if (publicId === MISSING_ID) return notFound();

      const reserved = reservedVideo(publicId);
      if (reserved) {
        return reserved.processingStatus === "failed"
          ? HttpResponse.json(
              envelope(
                409,
                "INVALID_VIDEO_STATE",
                "Video is in an invalid state",
              ),
              { status: 409 },
            )
          : HttpResponse.json<VideoResponse>(reserved);
      }

      const stored = store.get(publicId);
      const current = stored?.video ?? buildVideo({ publicId });
      if (current.processingStatus !== "awaiting_upload") {
        return HttpResponse.json<VideoResponse>(current);
      }
      const uploaded: VideoResponse = {
        ...current,
        processingStatus: "uploaded",
        sizeBytes: stored?.declaredSizeBytes ?? null,
      };
      if (stored) store.set(publicId, { ...stored, video: uploaded });
      return HttpResponse.json<VideoResponse>(uploaded);
    },
  ),

  // GET /videos/{publicId}/media-urls
  http.get(
    `${env.API_URL}/videos/:publicId/media-urls`,
    ({ request, params }) => {
      if (!hasBearer(request)) return unauthorized();
      const publicId = String(params.publicId);
      if (publicId === MISSING_ID) return notFound();

      if (lookup(publicId).processingStatus !== "ready") {
        return HttpResponse.json(
          envelope(409, "VIDEO_NOT_READY", "Video is not ready yet"),
          { status: 409 },
        );
      }
      return HttpResponse.json(
        buildMediaUrls({
          streamUrl: `${E2E_STORAGE_ORIGIN}/videos/${publicId}/video.mp4?X-Amz-Signature=fake-stream`,
          downloadUrl: `${E2E_STORAGE_ORIGIN}/videos/${publicId}/video.mp4?X-Amz-Signature=fake-download&response-content-disposition=attachment`,
        }),
      );
    },
  ),
];
