import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

// Shared cookie store for the session mock — same pattern as authorized-upstream.integration.test.ts.
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

const { setSession } = await import("@/lib/auth/session");
const { env } = await import("@/lib/env");

// openapi-fetch captures global fetch when the client is created, so the module under test
// must load after MSW patched fetch in the setup file's beforeAll.
let getVideo: typeof import("@/lib/videos/get-video").getVideo;

beforeAll(async () => {
  ({ getVideo } = await import("@/lib/videos/get-video"));
});

const SEED_SESSION = {
  accessToken: "session-access-token",
  refreshToken: "session-refresh-token",
  userId: "user-1",
  email: "alice@example.com",
  channelSlug: "alice",
};

beforeEach(() => {
  cookieMap.clear();
});

describe("getVideo", () => {
  it("sends the session's Bearer token and returns the video", async () => {
    await setSession(SEED_SESSION);
    const authorization: (string | null)[] = [];
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, ({ request }) => {
        authorization.push(request.headers.get("authorization"));
        return HttpResponse.json({
          publicId: "dQw4w9WgXcQ",
          filename: "holiday.mp4",
          processingStatus: "processing",
          publicationStatus: "draft",
          failureReason: null,
          durationMs: null,
          width: null,
          height: null,
          sizeBytes: null,
          thumbnailUrl: null,
          createdAt: "2026-10-14T10:00:00.000Z",
        });
      }),
    );

    const result = await getVideo("dQw4w9WgXcQ");

    expect(authorization).toEqual(["Bearer session-access-token"]);
    expect(result).toMatchObject({
      status: "ok",
      video: { publicId: "dQw4w9WgXcQ", processingStatus: "processing" },
    });
  });

  it("returns not_found for the reserved missing id", async () => {
    await setSession(SEED_SESSION);

    expect(await getVideo("missingVid1")).toEqual({ status: "not_found" });
  });

  it("returns unauthorized when the upstream answers 401", async () => {
    await setSession(SEED_SESSION);
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, () =>
        HttpResponse.json(
          { statusCode: 401, error: "UNAUTHORIZED", message: "Unauthorized" },
          { status: 401 },
        ),
      ),
    );

    expect(await getVideo("dQw4w9WgXcQ")).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized without calling the upstream when there is no session", async () => {
    let calls = 0;
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );

    expect(await getVideo("dQw4w9WgXcQ")).toEqual({ status: "unauthorized" });
    expect(calls).toBe(0);
  });

  it("throws on an unexpected upstream failure", async () => {
    await setSession(SEED_SESSION);
    server.use(
      http.get(`${env.API_URL}/videos/:publicId`, () =>
        HttpResponse.json(
          { statusCode: 500, error: "INTERNAL", message: "boom" },
          { status: 500 },
        ),
      ),
    );

    await expect(getVideo("dQw4w9WgXcQ")).rejects.toThrow(/500/);
  });
});
