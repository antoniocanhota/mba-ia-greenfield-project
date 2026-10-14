import "server-only";

import type { VideoResponse } from "@/lib/api/contracts";
import { upstream } from "@/lib/api/upstream";
import { getSession } from "@/lib/auth/session";

export type GetVideoResult =
  | { status: "ok"; video: VideoResponse }
  | { status: "not_found" }
  | { status: "unauthorized" };

/**
 * Reads a draft/video for a Server Component with the session's Bearer token. A RSC cannot
 * write the session cookie, so an expired token is reported as `unauthorized` (the page
 * redirects to /login) instead of being refreshed here.
 */
export async function getVideo(publicId: string): Promise<GetVideoResult> {
  const session = await getSession();
  if (!session.isLoggedIn) return { status: "unauthorized" };

  const { data, response } = await upstream.GET("/videos/{publicId}", {
    params: { path: { publicId } },
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  if (response.status === 404) return { status: "not_found" };
  if (response.status === 401) return { status: "unauthorized" };
  if (!response.ok || !data) {
    throw new Error(
      `Upstream GET /videos/${publicId} failed (${response.status})`,
    );
  }
  return { status: "ok", video: data };
}
