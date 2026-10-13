import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { MediaUrlsResponseDto } from './dto/media-urls-response.dto';
import { SignUploadRequestDto } from './dto/sign-upload-request.dto';
import { SignUploadResponseDto } from './dto/sign-upload-response.dto';
import { VideoResponseDto } from './dto/video-response.dto';
import { UploadSigningService } from './upload-signing.service';
import { VideosService } from './videos.service';

// The global ThrottlerGuard (10 req/min) would block part signing for large uploads,
// which issues thousands of requests per file.
@SkipThrottle()
@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly uploadSigningService: UploadSigningService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Pre-register a video as a draft',
    description:
      'Creates the video as a draft (awaiting upload) on the channel of the authenticated user and returns its public id.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft created',
    type: VideoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVideoDto,
  ): Promise<VideoResponseDto> {
    const video = await this.videosService.createDraft(user.sub, dto);
    return this.videosService.toResponse(video);
  }

  @Get(':publicId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a video of the authenticated user',
    description:
      'Returns the video to its owner. Unknown, malformed or foreign public ids are indistinguishable (404).',
  })
  @ApiParam({
    name: 'publicId',
    description: '11-character base64url public id of the video',
    example: 'dQw4w9WgXcQ',
  })
  @ApiResponse({
    status: 200,
    description: 'Video found',
    type: VideoResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found (or not owned by the user)',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<VideoResponseDto> {
    const video = await this.videosService.findOwnedByPublicId(
      user.sub,
      publicId,
    );
    return this.videosService.toResponse(video);
  }

  @Post(':publicId/upload-signatures')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Sign an S3 multipart upload operation',
    description:
      'Target of the Uppy signRequest: presigns one S3 multipart operation for the video original. Only allowed while the video is awaiting upload.',
  })
  @ApiParam({
    name: 'publicId',
    description: '11-character base64url public id of the video',
    example: 'dQw4w9WgXcQ',
  })
  @ApiBody({ type: SignUploadRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL for the requested operation',
    type: SignUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed, upload key mismatch or unsupported operation',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found (or not owned by the user)',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not awaiting upload',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async signUpload(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
    @Body() dto: SignUploadRequestDto,
  ): Promise<SignUploadResponseDto> {
    const video = await this.videosService.findOwnedByPublicId(
      user.sub,
      publicId,
    );
    return this.uploadSigningService.sign(video, dto);
  }

  @Post(':publicId/upload-completion')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Complete the upload and queue the video for processing',
    description:
      'Verifies the uploaded original, moves the video to `uploaded` and enqueues background processing. Idempotent: past `awaiting_upload` it returns the current state.',
  })
  @ApiParam({
    name: 'publicId',
    description: '11-character base64url public id of the video',
    example: 'dQw4w9WgXcQ',
  })
  @ApiResponse({
    status: 200,
    description: 'Current state of the video',
    type: VideoResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found (or not owned by the user)',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Uploaded file not found, or the video has failed processing',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 422,
    description: 'Uploaded file exceeds the 10GB limit',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async completeUpload(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<VideoResponseDto> {
    const video = await this.videosService.completeUpload(user.sub, publicId);
    return this.videosService.toResponse(video);
  }

  @Get(':publicId/media-urls')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get presigned streaming and download URLs',
    description:
      'Issues presigned GET URLs for the normalized MP4 of a ready video: one for streaming (HTTP Range served by the storage) and one for download. Owner only.',
  })
  @ApiParam({
    name: 'publicId',
    description: '11-character base64url public id of the video',
    example: 'dQw4w9WgXcQ',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URLs',
    type: MediaUrlsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found (or not owned by the user)',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getMediaUrls(
    @CurrentUser() user: JwtPayload,
    @Param('publicId') publicId: string,
  ): Promise<MediaUrlsResponseDto> {
    return this.videosService.getMediaUrls(user.sub, publicId);
  }
}
