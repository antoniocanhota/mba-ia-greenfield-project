import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

import type { VideoResponse } from "@/lib/api/contracts";
import { env } from "@/lib/env";
import { server } from "@/mocks/server";

// Cookie store mock for iron-session (same pattern as the auth route tests).
const cookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieMap.set(name, value);
    },
    delete: (name: string) => {
      cookieMap.delete(name);
    },
  }),
}));

type RouteContext = { params: Promise<{ publicId: string }> };
let POST: (req: Request, ctx: RouteContext) => Promise<Response>;
let GET: (req: Request, ctx: RouteContext) => Promise<Response>;
let CREATE: (req: Request) => Promise<Response>;
let setSession: typeof import("@/lib/auth/session").setSession;

// The routes import the openapi-fetch client, which captures global fetch on creation:
// load them after MSW patched fetch (setup file's beforeAll).
beforeAll(async () => {
  ({ POST } =
    await import("@/app/api/videos/[publicId]/upload-completion/route"));
  ({ GET } = await import("@/app/api/videos/[publicId]/route"));
  ({ POST: CREATE } = await import("@/app/api/videos/route"));
  ({ setSession } = await import("@/lib/auth/session"));
});

beforeEach(() => {
  cookieMap.clear();
});

const login = () =>
  setSession({
    accessToken: "session-access-token",
    refreshToken: "session-refresh-token",
    userId: "user-1",
    email: "alice@example.com",
    channelSlug: "alice",
  });

const complete = (publicId: string) =>
  POST(
    new Request(`http://localhost/api/videos/${publicId}/upload-completion`, {
      method: "POST",
    }),
    { params: Promise.resolve({ publicId }) },
  );

const COMPLETION_URL = `${env.API_URL}/videos/:publicId/upload-completion`;

describe("POST /api/videos/{publicId}/upload-completion", () => {
  it("returns 200 with the video moved from awaiting_upload to uploaded", async () => {
    await login();
    const draft = (await (
      await CREATE(
        new Request("http://localhost/api/videos", {
          method: "POST",
          body: JSON.stringify({
            filename: "clip.mp4",
            sizeBytes: 4096,
            contentType: "video/mp4",
          }),
        }),
      )
    ).json()) as VideoResponse;
    const read = async () =>
      (await (
        await GET(new Request("http://localhost"), {
          params: Promise.resolve({ publicId: draft.publicId }),
        })
      ).json()) as VideoResponse;
    expect((await read()).processingStatus).toBe("awaiting_upload");

    const res = await complete(draft.publicId);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject<Partial<VideoResponse>>({
      publicId: draft.publicId,
      processingStatus: "uploaded",
      sizeBytes: 4096,
    });
    expect((await read()).processingStatus).toBe("uploaded");
  });

  it("sends the publicId and the session Bearer token to the upstream, without a body", async () => {
    await login();
    let received:
      { path: string; authorization: string | null; body: string } | undefined;
    server.use(
      http.post(COMPLETION_URL, async ({ request }) => {
        received = {
          path: new URL(request.url).pathname,
          authorization: request.headers.get("authorization"),
          body: await request.text(),
        };
        return HttpResponse.json({});
      }),
    );

    await complete("abcdefghijk");

    expect(received).toEqual({
      path: "/videos/abcdefghijk/upload-completion",
      authorization: "Bearer session-access-token",
      body: "",
    });
  });

  it.each([
    [409, "UPLOAD_INCOMPLETE"],
    [409, "INVALID_VIDEO_STATE"],
    [422, "FILE_TOO_LARGE"],
    [404, "VIDEO_NOT_FOUND"],
  ])(
    "passes a %i %s upstream error through with the same envelope",
    async (status, code) => {
      await login();
      const envelope = {
        statusCode: status,
        error: code,
        message: "upstream says no",
      };
      server.use(
        http.post(COMPLETION_URL, () =>
          HttpResponse.json(envelope, { status }),
        ),
      );

      const res = await complete("abcdefghijk");

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(envelope);
    },
  );

  it("returns the missingVid1 404 VIDEO_NOT_FOUND from the fixtures", async () => {
    await login();

    const res = await complete("missingVid1");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });

  it("returns 401 UNAUTHORIZED without calling the upstream when there is no session", async () => {
    let upstreamCalls = 0;
    server.use(
      http.post(COMPLETION_URL, () => {
        upstreamCalls++;
        return HttpResponse.json({});
      }),
    );

    const res = await complete("abcdefghijk");

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(upstreamCalls).toBe(0);
  });
});
