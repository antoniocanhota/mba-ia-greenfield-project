import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { MAX_VIDEO_SIZE_BYTES } from '../videos.constants';

export class CreateVideoDto {
  /** Original name of the file being uploaded. */
  @IsString()
  @Length(1, 255)
  filename: string;

  /** Size of the file in bytes (up to 10 GiB). */
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_SIZE_BYTES)
  sizeBytes: number;

  /** MIME type of the file; must start with `video/`. */
  @IsString()
  @Matches(/^video\//)
  contentType: string;
}
