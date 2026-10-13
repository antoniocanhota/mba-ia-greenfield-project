export const S3_INTERNAL_CLIENT = Symbol('S3_INTERNAL_CLIENT');
export const S3_SIGNER_CLIENT = Symbol('S3_SIGNER_CLIENT');

// S3 requires parts of at least 5 MiB (except the last); PutObject caps at 5 GiB.
export const SINGLE_PUT_MAX_BYTES = 64 * 2 ** 20;
export const MULTIPART_PART_BYTES = 64 * 2 ** 20;
