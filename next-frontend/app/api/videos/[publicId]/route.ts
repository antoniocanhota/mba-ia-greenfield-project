import { upstream } from "@/lib/api/upstream";
import { callAuthorizedUpstream } from "@/lib/auth/authorized-upstream";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  const response = await callAuthorizedUpstream((headers) =>
    upstream.GET("/videos/{publicId}", {
      params: { path: { publicId } },
      headers,
    }),
  );

  // Status polling must always read the current state, never a cached copy.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
