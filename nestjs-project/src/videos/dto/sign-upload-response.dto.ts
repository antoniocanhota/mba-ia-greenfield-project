import { ApiProperty } from '@nestjs/swagger';

export class SignUploadResponseDto {
  @ApiProperty({
    description: 'Presigned S3 URL; expires after UPLOAD_SIGN_TTL_SECONDS',
  })
  url: string;

  @ApiProperty({
    required: false,
    description:
      'Server-defined object key; present only on CreateMultipartUpload',
    example: 'videos/dQw4w9WgXcQ/original',
  })
  key?: string;
}
