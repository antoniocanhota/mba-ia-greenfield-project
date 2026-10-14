import { http, HttpResponse } from "msw";
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

import { server } from "@/mocks/server";

// Shared cookie store for the session mock — same pattern as refresh.integration.test.ts.
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

const { setSession, getSession } = await import("@/lib/auth/session");
const { env } = await import("@/lib/env");

// openapi-fetch captures global fetch when the client is created, so the client (and the
// helper that imports it) must load after MSW patched fetch in the setup file's beforeAll.
let callAuthorizedUpstream: typeof import("@/lib/auth/authorized-upstream").callAuthorizedUpstream;
let upstream: typeof import("@/lib/api/upstream").upstream;

beforeAll(async () => {
  ({ callAuthorizedUpstream } = await import("@/lib/auth/authorized-upstream"));
  ({ upstream } = await import("@/lib/api/upstream"));
});

const VIDEO_URL = `${env.API_URL}/videos/dQw4w9WgXcQ`;
const REFRESH_URL = `${env.API_URL}/auth/refresh`;

const VIDEO = {
  publicId: "dQw4w9WgXcQ",
  filename: "holiday.mp4",
  processingStatus: "ready",
  publicationStatus: "draft",
  failureReason: null,
  durationMs: 1000,
  width: 1280,
  height: 720,
  sizeBytes: 2048,
  thumbnailUrl: null,
  createdAt: "2026-10-14T10:00:00.000Z",
};

const SEED_SESSION = {
  accessToken: "session-access-token",
  refreshToken: "session-refresh-token",
  userId: "user-1",
  email: "alice@example.com",
  channelSlug: "alice",
};

const getVideo = () =>
  callAuthorizedUpstream((headers) =>
    upstream.GET("/videos/{publicId}", {
      params: { path: { publicId: "dQw4w9WgXcQ" } },
      headers,
    }),
  );

beforeEach(() => {
  cookieMap.clear();
});

describe("callAuthorizedUpstream", () => {
  it("answers 401 UNAUTHORIZED without calling the upstream when there is no session", async () => {
    let upstreamCalls = 0;
    server.use(
      http.get(VIDEO_URL, () => {
        upstreamCalls++;
        return HttpResponse.json(VIDEO);
      }),
    );

    const res = await getVideo();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      statusCode: 401,
      error: "UNAUTHORIZED",
      message: "Session expired",
    });
    expect(upstreamCalls).toBe(0);
  });

  describe("with a session", () => {
    beforeEach(async () => {
      await setSession(SEED_SESSION);
    });

    it("sends the session access token as a Bearer header and passes the body through", async () => {
      let authorization: string | null = null;
      server.use(
        http.get(VIDEO_URL, ({ request }) => {
          authorization = request.headers.get("authorization");
          return HttpResponse.json(VIDEO);
        }),
      );

      const res = await getVideo();

      expect(authorization).toBe("Bearer session-access-token");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(VIDEO);
    });

    it("keeps the upstream success status (201) and body", async () => {
      server.use(
        http.post(`${env.API_URL}/videos/dQw4w9WgXcQ/upload-signatures`, () =>
          HttpResponse.json({ url: "https://storage/signed" }, { status: 201 }),
        ),
      );

      const res = await callAuthorizedUpstream((headers) =>
        upstream.POST("/videos/{publicId}/upload-signatures", {
          params: { path: { publicId: "dQw4w9WgXcQ" } },
          body: {} as never,
          headers,
        }),
      );

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ url: "https://storage/signed" });
    });

    it("refreshes once on a 401 and retries with the renewed token", async () => {
      const authorizations: (string | null)[] = [];
      let refreshCalls = 0;
      server.use(
        http.get(VIDEO_URL, ({ request }) => {
          authorizations.push(request.headers.get("authorization"));
          return authorizations.length === 1
            ? HttpResponse.json(
                { statusCode: 401, error: "Unauthorized", message: "expired" },
                { status: 401 },
              )
            : HttpResponse.json(VIDEO);
        }),
        http.post(REFRESH_URL, () => {
          refreshCalls++;
          return HttpResponse.json({
            access_token: "renewed-access-token",
            refresh_token: "renewed-refresh-token",
          });
        }),
      );

      const res = await getVideo();

      expect(refreshCalls).toBe(1);
      expect(authorizations).toEqual([
        "Bearer session-access-token",
        "Bearer renewed-access-token",
      ]);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(VIDEO);
      expect((await getSession()).accessToken).toBe("renewed-access-token");
    });

    it("answers 401 UNAUTHORIZED and drops the session when the refresh fails", async () => {
      server.use(
        http.get(VIDEO_URL, () =>
          HttpResponse.json(
            { statusCode: 401, error: "Unauthorized", message: "expired" },
            { status: 401 },
          ),
        ),
        http.post(REFRESH_URL, () => new HttpResponse(null, { status: 401 })),
      );

      const res = await getVideo();

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
      expect((await getSession()).isLoggedIn).toBeFalsy();
    });

    it.each([
      [
        404,
        {
          statusCode: 404,
          error: "Not Found",
          message: "Video not found",
          code: "VIDEO_NOT_FOUND",
        },
      ],
      [
        409,
        {
          statusCode: 409,
          error: "Conflict",
          message: "Invalid state",
          code: "INVALID_VIDEO_STATE",
        },
      ],
    ])(
      "passes a %i upstream error through with its status and envelope",
      async (status, envelope) => {
        let refreshCalls = 0;
        server.use(
          http.get(VIDEO_URL, () => HttpResponse.json(envelope, { status })),
          http.post(REFRESH_URL, () => {
            refreshCalls++;
            return new HttpResponse(null, { status: 500 });
          }),
        );

        const res = await getVideo();

        expect(res.status).toBe(status);
        expect(await res.json()).toEqual(envelope);
        expect(refreshCalls).toBe(0);
      },
    );
  });
});
