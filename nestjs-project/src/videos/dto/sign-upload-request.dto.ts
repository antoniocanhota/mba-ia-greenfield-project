import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const SIGN_UPLOAD_METHODS = ['PUT', 'POST', 'GET', 'DELETE'] as const;
export type SignUploadMethod = (typeof SIGN_UPLOAD_METHODS)[number];

// Mirrors the argument of `signRequest` in @uppy/aws-s3 6.
export class SignUploadRequestDto {
  /** HTTP method of the S3 request Uppy wants signed. */
  @IsIn(SIGN_UPLOAD_METHODS)
  method: SignUploadMethod;

  /** Object key proposed by Uppy; the server always uses its own key. */
  @IsString()
  @IsNotEmpty()
  key: string;

  /** Multipart upload id; present on operations over an existing multipart. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  uploadId?: string;

  /** Part number (1–10000); present only on UploadPart. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber?: number;
}
