import { upstream } from "@/lib/api/upstream";
import { callAuthorizedUpstream } from "@/lib/auth/authorized-upstream";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  const response = await callAuthorizedUpstream((headers) =>
    upstream.GET("/videos/{publicId}/media-urls", {
      params: { path: { publicId } },
      headers,
    }),
  );

  // The presigned URLs expire: a cached response would hand out dead links.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
