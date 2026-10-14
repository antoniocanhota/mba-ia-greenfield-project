import { notFound, redirect } from "next/navigation";

import { VideoStudioView } from "@/components/studio/video-studio-view";
import { getVideo } from "@/lib/videos/get-video";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const result = await getVideo(publicId);

  if (result.status === "not_found") notFound();
  if (result.status === "unauthorized") redirect("/login");

  return <VideoStudioView publicId={publicId} initialVideo={result.video} />;
}
