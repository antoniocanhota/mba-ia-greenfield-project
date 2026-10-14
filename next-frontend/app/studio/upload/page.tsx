import { VideoUploadDropzone } from "@/components/studio/video-upload-dropzone";

export default function UploadPage() {
  return (
    <div className="flex flex-col gap-6 px-6 pb-6 pt-8">
      <h1 className="text-h1 text-foreground">Upload Video</h1>
      <VideoUploadDropzone />
    </div>
  );
}
