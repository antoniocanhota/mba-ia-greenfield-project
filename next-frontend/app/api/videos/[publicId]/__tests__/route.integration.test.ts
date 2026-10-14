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

let GET: (
  req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) => Promise<Response>;
let setSession: typeof import("@/lib/auth/session").setSession;

// The route imports the openapi-fetch client, which captures global fetch on creation:
// load it after MSW patched fetch (setup file's beforeAll).
beforeAll(async () => {
  ({ GET } = await import("@/app/api/videos/[publicId]/route"));
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

const get = (publicId: string) =>
  GET(new Request(`http://localhost/api/videos/${publicId}`), {
    params: Promise.resolve({ publicId }),
  });

describe("GET /api/videos/{publicId}", () => {
  it("returns 200 with the upstream VideoResponse and Cache-Control: no-store", async () => {
    await login();

    const res = await get("procVid0001");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject<Partial<VideoResponse>>({
      publicId: "procVid0001",
      processingStatus: "processing",
    });
  });

  it("returns the default awaiting_upload fixture for an unknown, non-reserved id", async () => {
    await login();

    const res = await get("unknownVid1");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      processingStatus: "awaiting_upload",
    });
  });

  it("sends the publicId and the session Bearer token to the upstream", async () => {
    await login();
    let received: { url: string; authorization: string | null } | undefined;
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, ({ request }) => {
        received = {
          url: new URL(request.url).pathname,
          authorization: request.headers.get("authorization"),
        };
        return HttpResponse.json({});
      }),
    );

    await get("abcdefghijk");

    expect(received).toEqual({
      url: "/videos/abcdefghijk",
      authorization: "Bearer session-access-token",
    });
  });

  it("passes the missingVid1 404 VIDEO_NOT_FOUND envelope through, also without cache", async () => {
    await login();

    const res = await get("missingVid1");

    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({
      statusCode: 404,
      error: "VIDEO_NOT_FOUND",
    });
  });

  it("returns 401 UNAUTHORIZED without calling the upstream when there is no session", async () => {
    let upstreamCalls = 0;
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, () => {
        upstreamCalls++;
        return HttpResponse.json({});
      }),
    );

    const res = await get("procVid0001");

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(upstreamCalls).toBe(0);
  });
});
