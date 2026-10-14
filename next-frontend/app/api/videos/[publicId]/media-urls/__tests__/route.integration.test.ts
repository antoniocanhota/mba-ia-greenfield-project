import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

import type { MediaUrlsResponse } from "@/lib/api/contracts";
import { env } from "@/lib/env";
import { server } from "@/mocks/server";
import { E2E_STORAGE_ORIGIN } from "@/mocks/storage-origin";

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

let GET: (
  req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) => Promise<Response>;
let setSession: typeof import("@/lib/auth/session").setSession;

// The route imports the openapi-fetch client, which captures global fetch on creation:
// load it after MSW patched fetch (setup file's beforeAll).
beforeAll(async () => {
  ({ GET } = await import("@/app/api/videos/[publicId]/media-urls/route"));
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

const getMediaUrls = (publicId: string) =>
  GET(new Request(`http://localhost/api/videos/${publicId}/media-urls`), {
    params: Promise.resolve({ publicId }),
  });

const MEDIA_URLS_URL = `${env.API_URL}/videos/:publicId/media-urls`;

describe("GET /api/videos/{publicId}/media-urls", () => {
  it("returns 200 with streamUrl, downloadUrl and expiresAt for a ready video, uncached", async () => {
    await login();

    const res = await getMediaUrls("readyVid001");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = (await res.json()) as MediaUrlsResponse;
    expect(
      json.streamUrl.startsWith(`${E2E_STORAGE_ORIGIN}/videos/readyVid001/`),
    ).toBe(true);
    expect(json.downloadUrl).toContain(
      "response-content-disposition=attachment",
    );
    expect(Number.isNaN(Date.parse(json.expiresAt))).toBe(false);
  });

  it("sends the publicId and the session Bearer token to the upstream", async () => {
    await login();
    let received: { path: string; authorization: string | null } | undefined;
    server.use(
      http.get(MEDIA_URLS_URL, ({ request }) => {
        received = {
          path: new URL(request.url).pathname,
          authorization: request.headers.get("authorization"),
        };
        return HttpResponse.json({});
      }),
    );

    await getMediaUrls("abcdefghijk");

    expect(received).toEqual({
      path: "/videos/abcdefghijk/media-urls",
      authorization: "Bearer session-access-token",
    });
  });

  it("passes the 409 VIDEO_NOT_READY envelope through for a video that is not ready", async () => {
    await login();

    const res = await getMediaUrls("procVid0001");

    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({
      statusCode: 409,
      error: "VIDEO_NOT_READY",
    });
  });

  it("passes the missingVid1 404 VIDEO_NOT_FOUND envelope through", async () => {
    await login();

    const res = await getMediaUrls("missingVid1");

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });

  it("returns 401 UNAUTHORIZED without calling the upstream when there is no session", async () => {
    let upstreamCalls = 0;
    server.use(
      http.get(MEDIA_URLS_URL, () => {
        upstreamCalls++;
        return HttpResponse.json({});
      }),
    );

    const res = await getMediaUrls("readyVid001");

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(upstreamCalls).toBe(0);
  });
});
