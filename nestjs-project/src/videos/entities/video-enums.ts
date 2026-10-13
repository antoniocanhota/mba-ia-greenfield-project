export enum VideoProcessingStatus {
  AWAITING_UPLOAD = 'awaiting_upload',
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export enum VideoPublicationStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum VideoFailureReason {
  NOT_A_VIDEO = 'not_a_video',
  UNREADABLE_FILE = 'unreadable_file',
  UNSUPPORTED_MEDIA = 'unsupported_media',
  PROCESSING_ERROR = 'processing_error',
  UPLOAD_ABANDONED = 'upload_abandoned',
}
