import { ApiProperty } from '@nestjs/swagger';

export class MediaUrlsResponseDto {
  @ApiProperty({
    description:
      'Presigned GET of the normalized MP4 for <video src>; the storage serves HTTP Range',
  })
  streamUrl: string;

  @ApiProperty({
    description:
      'Presigned GET of the same MP4 with a Content-Disposition: attachment filename',
  })
  downloadUrl: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'When both URLs expire',
  })
  expiresAt: string;
}
