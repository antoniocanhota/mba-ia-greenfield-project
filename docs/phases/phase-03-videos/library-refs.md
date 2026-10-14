---
libs:
  "@aws-sdk/client-s3":
    version: "^3.1147.0"
    context7_id: "/aws/aws-sdk-js-v3"
    fetched_at: "2026-10-07T14:44:00-03:00"
  "@aws-sdk/s3-request-presigner":
    version: "^3.1147.0"
    context7_id: "/aws/aws-sdk-js-v3"
    fetched_at: "2026-10-07T14:44:00-03:00"
  bullmq:
    version: "^6.3.11"
    context7_id: "/taskforcesh/bullmq"
    fetched_at: "2026-10-07T14:44:00-03:00"
  "@nestjs/bullmq":
    version: "^12.0.0"
    context7_id: "/nestjs/docs.nestjs.com"
    fetched_at: "2026-10-07T14:44:00-03:00"
  "@uppy/core":
    version: "^6.2.0"
    context7_id: "/websites/uppy_io"
    fetched_at: "2026-10-07T14:44:00-03:00"
  "@uppy/aws-s3":
    version: "^6.2.2"
    context7_id: "/websites/uppy_io"
    fetched_at: "2026-10-07T14:44:00-03:00"
  "@uppy/react":
    version: "^6.0.0"
    context7_id: "/websites/uppy_io"
    fetched_at: "2026-10-14T09:50:37-03:00"
  fluent-ffmpeg:
    version: "^2.1.3"
    context7_id: "/fluent-ffmpeg/node-fluent-ffmpeg"
    fetched_at: "2026-10-07T14:44:00-03:00"
sources_mtime:
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-14T09:18:25-03:00"
  docs/decisions/technical-decisions-video-metadata.md: "2026-10-13T14:25:28-03:00"
---

# phase-03-videos — Library References

Distilled docs for the libraries decided in this phase, pulled via Context7 on 2026-10-07. Versions are the latest published on npm at fetch time (`npm view`). Re-fetch when the underlying TD changes: resolve refreshes this file when the library set in `## Decisions Index` drifts from the cached set here.

## @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner

**Source:** `/aws/aws-sdk-js-v3` (Context7), High reputation. Maps to `phase-03-videos/TD-01` (storage client), `TD-04` (presigned multipart), `TD-09` (presigned delivery).

### Client with a custom endpoint (two clients, per TD-01)

```typescript
import { S3Client } from "@aws-sdk/client-s3";

// Server-side calls: Compose service name, never localhost (Docker networking rule).
const internal = new S3Client({ endpoint: "http://<storage-service>:9000", forcePathStyle: true, region, credentials });

// Presigning only: browser-reachable endpoint. Signing is offline, so this client never connects.
const publicSigner = new S3Client({ endpoint: "http://localhost:9000", forcePathStyle: true, region, credentials });
```

`endpoint` accepts a URL string or an async function returning `{ hostname, path, protocol, port }`.

### Presigning

```typescript
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const url = await getSignedUrl(publicSigner, new GetObjectCommand({ Bucket, Key }), { expiresIn: 3600 });
```

- `expiresIn` defaults to **900 s**. TD-09 says video presign TTL should exceed a viewing session ("hours, not minutes"), so set it explicitly.
- The same `getSignedUrl(client, command, opts)` call presigns the multipart commands Uppy's `signRequest` asks for (`CreateMultipartUploadCommand`, `UploadPartCommand` with `UploadId` + `PartNumber`, `CompleteMultipartUploadCommand`, `AbortMultipartUploadCommand`).
- `ContentDisposition` on `GetObjectCommand` (`ResponseContentDisposition`) is the hook for the download variant in TD-09.

### HeadObject (TD-04 size cap / completion check)

`HeadObjectCommand` returns `ContentLength`, `LastModified` and checksum fields (checksums only with `ChecksumMode: "ENABLED"`). Use `ContentLength` to enforce the 10GB cap after completion.

### Lifecycle (TD-04 revision 2026-10-07)

`AbortIncompleteMultipartUpload` is configured with `PutBucketLifecycleConfigurationCommand` (rule with `AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 }`). Not covered by the fetched snippets: confirm that the pinned MinIO image supports bucket lifecycle at implement time.

## bullmq

**Source:** `/taskforcesh/bullmq` (Context7), High reputation, v6. Maps to `phase-03-videos/TD-02`, `TD-03`, and the `TD-04` sweep revision.

### Idempotent enqueue (`jobId = videoId`)

```typescript
await queue.add("process-video", { videoId }, { jobId: videoId });
```

- A job whose `jobId` already exists is **ignored**, which gives the idempotency TD-02 relies on.
- Custom IDs **must not contain `:`** and must not be purely numeric. UUIDs are fine.
- Caveat: with `removeOnComplete` / `removeOnFail`, a removed job no longer counts as existing, so the same `jobId` can be enqueued again. Keep this in mind for the dual-write sweep.

### Progress, retries, stalls

- In the worker, call `await job.updateProgress(n)` to persist progress (TD-11 progress percentage source).
- Retries: `attempts` + `backoff` in job options (`backoff: 3000` or `{ type: 'exponential' | 'custom', ... }`).
- Stalled jobs: a job whose lock expires is retried, or failed after `maxStalledCount` (default 1) stalls. Long FFmpeg jobs keep the lock alive automatically while the processor runs. Avoid blocking the event loop (spawned ffmpeg is fine).

### Repeatable sweep (v6 API: Job Schedulers)

v6 replaces v5 repeatable jobs with `upsertJobScheduler`:

```typescript
await queue.upsertJobScheduler(
  "sweep-abandoned-uploads",
  { pattern: "0 */15 * * * *" },        // cron, or { every: ms }
  { name: "sweep-abandoned-uploads", data: {}, opts: { attempts: 3 } },
);
```

`upsertJobScheduler` is idempotent by scheduler ID, so calling it at worker boot is safe.

## @nestjs/bullmq

**Source:** `/nestjs/docs.nestjs.com` § Queues (Context7), High reputation. npm `12.0.0` declares peers `@nestjs/common|core ^10 || ^11 || ^12` and `bullmq ^3–^6`, so it is compatible with this project's NestJS 11 and bullmq 6.

### Module wiring (async config, per Phase 01 conventions)

```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [queueConfig.KEY],
  useFactory: (cfg: ConfigType<typeof queueConfig>) => ({
    connection: { host: cfg.host, port: cfg.port }, // Compose service name for host
  }),
});
BullModule.registerQueue({ name: "videos" });
```

The docs snippet shows a `redis:` key, which belongs to the legacy `@nestjs/bull` API. `@nestjs/bullmq` takes BullMQ's `connection` option. Use `registerAs` + `ConfigType` injection to match the inherited config conventions.

### Producer and consumer

```typescript
@Injectable()
export class VideosService {
  constructor(@InjectQueue("videos") private readonly videosQueue: Queue) {}
}

@Processor("videos")
export class VideoProcessor extends WorkerHost {
  async process(job: Job<{ videoId: string }>): Promise<void> {
    await job.updateProgress(10);
    // ...
  }
}
```

- Processors must be registered as providers. Per TD-03, register `VideoProcessor` **only** in the worker entrypoint's module, so the API process produces jobs but never consumes them.
- Sandboxed (forked) processors exist but lose DI. They are not needed here because TD-03 already isolates the worker in its own process and container.

## @uppy/core + @uppy/aws-s3

**Source:** `/websites/uppy_io` (Context7), High reputation, Uppy 6. Maps to `phase-03-videos/TD-05` (and the client side of `TD-04`).

### `signRequest` replaces the six multipart callbacks (Uppy 6)

In Uppy 6, `getUploadParameters`, `createMultipartUpload`, `listParts`, `signPart`, `abortMultipartUpload` and `completeMultipartUpload` are replaced by a **single `signRequest`**. Uppy performs the S3 API calls itself, and the backend only presigns URLs. This is the "single BFF route" TD-05 relies on.

```typescript
uppy.use(AwsS3, {
  shouldUseMultipart: true,                                    // default: files > 100 MiB
  getChunkSize: (file) => Math.max(5 * 2 ** 20, file.size / 1000), // S3 min part = 5 MiB; default size/10000
  limit: 6,                                                    // parallel uploads (default 6)
  async signRequest({ method, key, uploadId, partNumber }) {
    const res = await fetch("/api/videos/{publicId}/upload/sign", { method: "POST", body: JSON.stringify({ method, key, uploadId, partNumber }) });
    return res.json();                                         // { url, key? }
  },
});
```

- `generateObjectKey(file)` defaults to `${crypto.randomUUID()}-${file.name}`. Override it so the key comes from the server-side draft (the API owns the object key).
- Restrictions (OQ-5): `new Uppy({ restrictions: { maxNumberOfFiles: 1, maxFileSize: 10 * 2 ** 30 } })`.
- For a 10GB file, the default chunk size (size/10000 ≈ 1 MiB) is below the S3 minimum, so `getChunkSize` must enforce ≥ 5 MiB.

### React (headless) provider (OQ-6: provider in the `/studio` layout)

The provider uses `@uppy/react`, adopted by the 2026-10-14 TD-05 revision. See the `@uppy/react` section below.

## @uppy/react

**Source:** `/websites/uppy_io` (Context7), High reputation, Uppy 6. Maps to `phase-03-videos/TD-05` (revision 2026-10-14). Latest 6.x on npm: `6.0.0`. Peers: `@uppy/core ^6.0.0`, `react`/`react-dom` `^18 || ^19`. `@uppy/dashboard`, `@uppy/status-bar`, `@uppy/webcam` and `@uppy/screen-capture` are optional peers and stay uninstalled. Runtime deps pulled in: `@uppy/components`, `preact`, `use-sync-external-store`.

### `UppyContextProvider` (provider in the `/studio` layout)

```tsx
"use client";
import { UppyContextProvider } from "@uppy/react";
import { useState } from "react";

const [uppy] = useState(() => createUppy(/* ... */)); // initializer: never recreate the instance
return <UppyContextProvider uppy={uppy}>{children}</UppyContextProvider>;
```

- Context value (`useContext(UppyContext)`): `{ uppy: Uppy | undefined; status: "init" | "ready" | "uploading" | "paused" | "error" | "complete"; progress: number }`.
- `status`/`progress` are global to the instance. The per-`publicId` domain state (`phase: "uploading" | "completing" | "completed" | "error"`, the `video` returned by `upload-completion`) stays in the app's own provider layered on top (TD-05 revision).

### `useUppyState` / `useUppyEvent`

```tsx
const files = useUppyState(uppy, (state) => state.files);
const totalProgress = useUppyState(uppy, (state) => state.totalProgress);

const [results, clearResults] = useUppyEvent(uppy, "upload-success"); // typed tuple of the event args
useUppyEvent(uppy, "cancel-all", clearResults);
```

- `useUppyState(uppy, selector)` subscribes to the Uppy store reactively (selector-based, re-renders only when the selected slice changes).
- `useUppyEvent(uppy, event, callback?)` returns `[results, clear]`, strongly typed per event.

### Not used in this phase

- `Dropzone` / `useDropzone` / `useFileInput`: file selection stays on the existing `UploadDropzone` (TD-05 revision).
- `@uppy/react/dashboard` and the Uppy CSS: the UI is shadcn/Tailwind (headless use).

## fluent-ffmpeg

**Source:** `/fluent-ffmpeg/node-fluent-ffmpeg` (Context7), Medium reputation, v2.1.3. The upstream repo is archived; the risk is accepted in the 2026-10-07 TD-10 revision. Maps to `phase-03-videos/TD-10`, `TD-08`, and `video-metadata/TD-01..03`.

### Probe (video-metadata/TD-02 two-stage)

```typescript
ffmpeg.ffprobe(path, (err, data) => {
  data.format.duration;   // string seconds, e.g. "596.459000" → convert to integer ms (video-metadata/TD-03)
  data.streams;           // codec_type, codec_name, width, height, display_aspect_ratio, duration, ...
});
```

Rotation for "rotation-applied display dimensions" (video-metadata/TD-03) is carried in stream side data / tags (`displaymatrix` / `rotate`), which the fetched snippets do not cover. Verify against the ffprobe output of a rotated phone video at implement time.

### Remux / transcode to progressive MP4 (TD-08)

```typescript
ffmpeg(input)
  .outputOptions(["-c", "copy", "-movflags", "+faststart"])  // remux path (H.264/AAC)
  .on("progress", (p) => p.percent /* optional, may be undefined */)
  .on("error", (err, stdout, stderr) => { /* classify into failureReason; stderr → logs only */ })
  .on("end", () => {})
  .save(output);
```

`+faststart` moves the `moov` atom to the front so the browser can start playback before downloading the whole file, which is the TD-08 streaming guarantee. `progress.percent` is optional, so fall back to `timemark` / duration when it is undefined.

### Thumbnail (capability "Geração automática de thumbnail")

```typescript
ffmpeg(input).screenshots({ timestamps: ["10%"], filename: "thumb.jpg", folder: tmpDir, size: "1280x?" });
```

- `screenshots` **does not work on input streams**, so the worker must download the object to a local temp file first.
- Use the `size` option, not `.size()`. Timestamps accept seconds, `"hh:mm:ss.xxx"` or a percentage.
- Use `ffmpeg.setFfmpegPath` / `setFfprobePath` only if the binaries are not on `PATH` (TD-10: apt-installed in the image).
