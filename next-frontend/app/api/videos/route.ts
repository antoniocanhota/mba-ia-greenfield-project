import type { CreateVideoDto } from "@/lib/api/contracts";
import { upstream } from "@/lib/api/upstream";
import { callAuthorizedUpstream } from "@/lib/auth/authorized-upstream";

export async function POST(request: Request) {
  // A malformed body is forwarded as empty so the upstream answers its own 400.
  const body = (await request.json().catch(() => ({}))) as CreateVideoDto;

  return callAuthorizedUpstream((headers) =>
    upstream.POST("/videos", { body, headers }),
  );
}
