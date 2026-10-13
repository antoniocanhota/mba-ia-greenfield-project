import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { request as httpRequest, type IncomingHttpHeaders } from 'http';
import storageConfig from '../config/storage.config';

export type StorageTestConfig = ReturnType<typeof storageConfig>;

// Real storage from the Compose stack, but an isolated bucket per spec file.
export function buildTestStorageConfig(): StorageTestConfig {
  return {
    ...storageConfig(),
    bucket: `test-${randomBytes(6).toString('hex')}`,
  };
}

export async function deleteTestBucket(
  config: StorageTestConfig,
): Promise<void> {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId as string,
      secretAccessKey: config.secretAccessKey as string,
    },
  });
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: config.bucket }),
  );
  if (listed.Contents?.length) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: listed.Contents.map(({ Key }) => ({ Key })) },
      }),
    );
  }
  await client.send(new DeleteBucketCommand({ Bucket: config.bucket }));
  client.destroy();
}

export interface InternalFetchResult {
  status: number;
  text: string;
  headers: IncomingHttpHeaders;
}

// The public endpoint (localhost:9000) only resolves from the host machine. Inside the
// container, reach the same server through the internal endpoint while keeping the public
// Host header, which is what the presigned signature covers.
export function fetchViaInternalEndpoint(
  url: string,
  config: StorageTestConfig,
  init: {
    method?: string;
    body?: Buffer | string;
    headers?: Record<string, string>;
  } = {},
): Promise<InternalFetchResult> {
  const publicUrl = new URL(url);
  const internal = new URL(config.endpoint as string);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: internal.hostname,
        port: internal.port,
        path: `${publicUrl.pathname}${publicUrl.search}`,
        method: init.method ?? 'GET',
        headers: {
          ...init.headers,
          host: publicUrl.host,
          // S3 rejects chunked uploads; UploadPart needs an explicit length.
          ...(init.body !== undefined && {
            'content-length': Buffer.byteLength(init.body),
          }),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode as number,
            text: Buffer.concat(chunks).toString(),
            headers: res.headers,
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(init.body);
  });
}
