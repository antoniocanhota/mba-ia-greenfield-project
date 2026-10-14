import type { SignUploadRequestDto } from "@/lib/api/contracts";
import { upstream } from "@/lib/api/upstream";
import { callAuthorizedUpstream } from "@/lib/auth/authorized-upstream";

// Single route behind Uppy's `signRequest`: one call per S3 operation (create, part, list,
// complete, abort). The upstream decides what may be signed; the BFF only forwards.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  // A malformed body is forwarded as empty so the upstream answers its own 400.
  const body = (await request.json().catch(() => ({}))) as SignUploadRequestDto;

  return callAuthorizedUpstream((headers) =>
    upstream.POST("/videos/{publicId}/upload-signatures", {
      params: { path: { publicId } },
      body,
      headers,
    }),
  );
}
