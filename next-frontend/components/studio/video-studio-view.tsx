import { VideoDetailsCard } from "@/components/studio/video-details-card";
import { ThumbUpload } from "@/components/studio/thumb-upload";
import { UploadProgressPanel } from "@/components/studio/upload-progress-panel";
import { VideoStatusBadge } from "@/components/studio/video-status-badge";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";

// Visual shell of the in-progress upload state: static placeholder values until the wiring
// (SI-03.31b) feeds it the video, the upload progress and the processing status.
export function VideoStudioView() {
  return (
    <div className="flex flex-col gap-6 px-6 pb-6 pt-8">
      <h1 className="text-h1 text-foreground">Video details</h1>
      <Card className="gap-6 p-8">
        <UploadProgressPanel
          filename="my_awesome_video_final_v2.mp4"
          percent={84}
          status={<VideoStatusBadge copy="Uploading" />}
        />
        <div className="flex items-start gap-16">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <SectionHeader
              title="Thumbnail"
              description="Select or upload a picture that shows what's in your video."
            />
            <ThumbUpload className="w-[266px]" />
          </div>
          <VideoDetailsCard
            className="w-[328px] shrink-0"
            videoUrl="https://streamtube.test/v/tech2024"
            filename="my_awesome_video_final_v2.mp4"
          />
        </div>
      </Card>
    </div>
  );
}
