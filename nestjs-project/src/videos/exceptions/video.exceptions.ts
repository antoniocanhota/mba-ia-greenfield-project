import { DomainException } from '../../common/exceptions/domain.exception';

export class VideoNotFoundException extends DomainException {
  constructor() {
    super('VIDEO_NOT_FOUND', 404, 'Video not found');
  }
}

export class InvalidVideoStateException extends DomainException {
  constructor() {
    super(
      'INVALID_VIDEO_STATE',
      409,
      'Operation not allowed in the current processing status',
    );
  }
}

export class VideoNotReadyException extends DomainException {
  constructor() {
    super('VIDEO_NOT_READY', 409, 'Video is not ready');
  }
}

export class InvalidUploadKeyException extends DomainException {
  constructor() {
    super(
      'INVALID_UPLOAD_KEY',
      400,
      'Upload key does not belong to this video',
    );
  }
}

export class UnsupportedUploadOperationException extends DomainException {
  constructor() {
    super('UNSUPPORTED_UPLOAD_OPERATION', 400, 'Unsupported upload operation');
  }
}

export class UploadIncompleteException extends DomainException {
  constructor() {
    super('UPLOAD_INCOMPLETE', 409, 'Uploaded file not found');
  }
}

export class FileTooLargeException extends DomainException {
  constructor() {
    super('FILE_TOO_LARGE', 422, 'File exceeds the 10GB limit');
  }
}
