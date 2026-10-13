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
import { VideoResponseDto } from './dto/video-response.dto';
import { VideosService } from './videos.service';

// The global ThrottlerGuard (10 req/min) would block part signing for large uploads,
// which issues thousands of requests per file.
@SkipThrottle()
@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

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
}
