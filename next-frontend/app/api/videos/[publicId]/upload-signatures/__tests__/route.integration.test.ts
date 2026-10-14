import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

import type { SignUploadResponse } from "@/lib/api/contracts";
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

let POST: (
  req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) => Promise<Response>;
let setSession: typeof import("@/lib/auth/session").setSession;

// The route imports the openapi-fetch client, which captures global fetch on creation:
// load it after MSW patched fetch (setup file's beforeAll).
beforeAll(async () => {
  ({ POST } =
    await import("@/app/api/videos/[publicId]/upload-signatures/route"));
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

const sign = (publicId: string, body: unknown) =>
  POST(
    new Request(`http://localhost/api/videos/${publicId}/upload-signatures`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ publicId }) },
  );

const SIGN_URL = `${env.API_URL}/videos/:publicId/upload-signatures`;

describe("POST /api/videos/{publicId}/upload-signatures", () => {
  it("returns 201 with the upstream url and key for CreateMultipartUpload", async () => {
    await login();

    const res = await sign("abcdefghijk", {
      method: "POST",
      key: "client-key",
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as SignUploadResponse;
    expect(json.key).toBe("videos/abcdefghijk/original");
    expect(new URL(json.url).origin).toBe(E2E_STORAGE_ORIGIN);
  });

  it("returns only the url for an UploadPart signature", async () => {
    await login();

    const res = await sign("abcdefghijk", {
      method: "PUT",
      key: "k",
      uploadId: "up-1",
      partNumber: 2,
    });

    const json = (await res.json()) as SignUploadResponse;
    expect(res.status).toBe(201);
    expect(new URL(json.url).searchParams.get("partNumber")).toBe("2");
    expect(json.key).toBeUndefined();
  });

  it("forwards publicId, body and the session Bearer token to the upstream", async () => {
    await login();
    let received:
      { path: string; authorization: string | null; body: unknown } | undefined;
    server.use(
      http.post(SIGN_URL, async ({ request }) => {
        received = {
          path: new URL(request.url).pathname,
          authorization: request.headers.get("authorization"),
          body: await request.json(),
        };
        return HttpResponse.json({ url: "https://signed" }, { status: 201 });
      }),
    );
    const body = { method: "PUT", key: "k", uploadId: "up-1", partNumber: 7 };

    await sign("abcdefghijk", body);

    expect(received).toEqual({
      path: "/videos/abcdefghijk/upload-signatures",
      authorization: "Bearer session-access-token",
      body,
    });
  });

  it.each([
    [400, "INVALID_UPLOAD_KEY"],
    [404, "VIDEO_NOT_FOUND"],
    [409, "INVALID_VIDEO_STATE"],
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
        http.post(SIGN_URL, () => HttpResponse.json(envelope, { status })),
      );

      const res = await sign("abcdefghijk", { method: "POST", key: "k" });

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(envelope);
    },
  );

  it("returns the missingVid1 404 VIDEO_NOT_FOUND from the fixtures", async () => {
    await login();

    const res = await sign("missingVid1", { method: "POST", key: "k" });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "VIDEO_NOT_FOUND" });
  });

  it("forwards a malformed body as empty so the upstream answers its own 400", async () => {
    await login();
    let received: unknown;
    server.use(
      http.post(SIGN_URL, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          {
            statusCode: 400,
            error: "VALIDATION_ERROR",
            message: ["method must be a valid enum value"],
          },
          { status: 400 },
        );
      }),
    );

    const res = await sign("abcdefghijk", "{not json");

    expect(received).toEqual({});
    expect(res.status).toBe(400);
  });

  it("returns 401 UNAUTHORIZED without calling the upstream when there is no session", async () => {
    let upstreamCalls = 0;
    server.use(
      http.post(SIGN_URL, () => {
        upstreamCalls++;
        return HttpResponse.json({ url: "https://signed" }, { status: 201 });
      }),
    );

    const res = await sign("abcdefghijk", { method: "POST", key: "k" });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHORIZED" });
    expect(upstreamCalls).toBe(0);
  });
});
