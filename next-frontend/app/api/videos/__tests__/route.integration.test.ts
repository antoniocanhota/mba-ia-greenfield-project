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

let POST: (req: Request) => Promise<Response>;
let setSession: typeof import("@/lib/auth/session").setSession;

// The route imports the openapi-fetch client, which captures global fetch on creation:
// load it after MSW patched fetch (setup file's beforeAll).
beforeAll(async () => {
  ({ POST } = await import("@/app/api/videos/route"));
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

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/videos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const VALID_BODY = {
  filename: "my-video.mp4",
  sizeBytes: 4096,
  contentType: "video/mp4",
};

describe("POST /api/videos", () => {
  it("returns 201 with the upstream VideoResponse as an awaiting_upload draft", async () => {
    await login();

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject<Partial<VideoResponse>>({
      publicId: "vid00000001",
      filename: "my-video.mp4",
      processingStatus: "awaiting_upload",
    });
  });

  it("forwards the body and the session Bearer token to the upstream", async () => {
    await login();
    let received: { authorization: string | null; body: unknown } | undefined;
    server.use(
      http.post(`${env.API_URL}/videos`, async ({ request }) => {
        received = {
          authorization: request.headers.get("authorization"),
          body: await request.json(),
        };
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    await POST(makeRequest(VALID_BODY));

    expect(received).toEqual({
      authorization: "Bearer session-access-token",
      body: VALID_BODY,
    });
  });

  it("passes a 400 VALIDATION_ERROR from the upstream through (too-large.mp4 trigger)", async () => {
    await login();

    const res = await POST(
      makeRequest({ ...VALID_BODY, filename: "too-large.mp4" }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      statusCode: 400,
      error: "VALIDATION_ERROR",
    });
  });

  it("forwards a malformed body as empty so the upstream answers its own 400", async () => {
    await login();
    let received: unknown;
    server.use(
      http.post(`${env.API_URL}/videos`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          {
            statusCode: 400,
            error: "VALIDATION_ERROR",
            message: ["filename must be a string"],
          },
          { status: 400 },
        );
      }),
    );

    const res = await POST(makeRequest("{not json"));

    expect(received).toEqual({});
    expect(res.status).toBe(400);
  });

  it("returns 401 UNAUTHORIZED without calling the upstream when there is no session", async () => {
    let upstreamCalls = 0;
    server.use(
      http.post(`${env.API_URL}/videos`, () => {
        upstreamCalls++;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(upstreamCalls).toBe(0);
  });
});
