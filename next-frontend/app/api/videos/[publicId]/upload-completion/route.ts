import { upstream } from "@/lib/api/upstream";
import { callAuthorizedUpstream } from "@/lib/auth/authorized-upstream";

// No request body: the upstream verifies the stored object itself (HeadObject) before it
// moves the video to `uploaded` and queues the processing job.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  return callAuthorizedUpstream((headers) =>
    upstream.POST("/videos/{publicId}/upload-completion", {
      params: { path: { publicId } },
      headers,
    }),
  );
}
