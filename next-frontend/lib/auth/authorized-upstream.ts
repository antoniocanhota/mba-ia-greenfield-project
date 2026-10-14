import "server-only";
import { NextResponse } from "next/server";

import type { ApiErrorEnvelope } from "@/lib/api/contracts";

import { withRefresh } from "./refresh";
import { getSession } from "./session";

// Structural subset of an openapi-fetch result: enough to pass the upstream through.
interface UpstreamResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

// A type alias (not an interface) so it is assignable to openapi-fetch's header record.
export type AuthorizedHeaders = { Authorization: string };

const SESSION_EXPIRED: ApiErrorEnvelope = {
  statusCode: 401,
  error: "UNAUTHORIZED",
  message: "Session expired",
};

function toNextResponse({ data, error, response }: UpstreamResult) {
  if (response.ok) {
    // 204/empty bodies have no `data`.
    return data === undefined
      ? new NextResponse(null, { status: response.status })
      : NextResponse.json(data, { status: response.status });
  }
  // Upstream error envelope goes through untouched, with the upstream status.
  return NextResponse.json(error ?? null, { status: response.status });
}

/**
 * Runs an upstream call on behalf of the logged-in user: requires a session, injects the
 * Bearer token server-side (re-read on every attempt, so a retry after a refresh carries
 * the new token) and refreshes once, single-flight, on a 401. The result is returned as a
 * pass-through NextResponse so Route Handlers stay thin.
 */
export async function callAuthorizedUpstream(
  call: (headers: AuthorizedHeaders) => Promise<UpstreamResult>,
): Promise<NextResponse> {
  if (!(await getSession()).isLoggedIn) {
    return NextResponse.json(SESSION_EXPIRED, { status: 401 });
  }

  let last: UpstreamResult | undefined;
  const final = await withRefresh(async () => {
    const { accessToken } = await getSession();
    last = await call({ Authorization: `Bearer ${accessToken}` });
    return last.response;
  });

  // withRefresh answers with its own 401 when the refresh failed: not an upstream result.
  if (!last || final !== last.response) {
    return NextResponse.json(SESSION_EXPIRED, { status: 401 });
  }
  return toNextResponse(last);
}
