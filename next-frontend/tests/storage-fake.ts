import type { Page, Route } from "@playwright/test";

import { E2E_STORAGE_ORIGIN } from "../mocks/storage-origin";

// Browser-side fake of the S3 subset @uppy/aws-s3 uses against presigned URLs
// (e2e-video-upload-fixtures/TD-01). It is scoped to the reserved storage origin; the
// /api/** Route Handlers are never intercepted. Playwright answers the CORS preflight of
// intercepted requests itself, so only the real responses need CORS headers.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "ETag",
};

const xml = (body: string) => ({
  status: 200,
  contentType: "application/xml",
  headers: CORS_HEADERS,
  body: `<?xml version="1.0" encoding="UTF-8"?>${body}`,
});

export async function routeStorageFake(page: Page): Promise<void> {
  // Per page (= per test): parts the fake has "stored", by uploadId, to answer ListParts.
  const parts = new Map<string, Map<number, string>>();
  let uploads = 0;

  await page.route(`${E2E_STORAGE_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = decodeURIComponent(url.pathname.slice(1));
    const uploadId = url.searchParams.get("uploadId");
    const partNumber = Number(url.searchParams.get("partNumber"));

    switch (request.method()) {
      case "POST": {
        if (!uploadId) {
          const id = `e2e-upload-${++uploads}`;
          parts.set(id, new Map());
          return route.fulfill(
            xml(
              `<InitiateMultipartUploadResult><Bucket>e2e</Bucket><Key>${key}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`,
            ),
          );
        }
        return route.fulfill(
          xml(
            `<CompleteMultipartUploadResult><Location>${E2E_STORAGE_ORIGIN}/${key}</Location><Bucket>e2e</Bucket><Key>${key}</Key><ETag>"e2e-complete"</ETag></CompleteMultipartUploadResult>`,
          ),
        );
      }
      case "PUT": {
        const etag = `"e2e-part-${partNumber}"`;
        if (uploadId) parts.get(uploadId)?.set(partNumber, etag);
        return route.fulfill({
          status: 200,
          headers: { ...CORS_HEADERS, etag },
        });
      }
      case "GET": {
        const stored = [...(parts.get(uploadId ?? "") ?? [])]
          .map(
            ([number, etag]) =>
              `<Part><PartNumber>${number}</PartNumber><ETag>${etag}</ETag><Size>0</Size></Part>`,
          )
          .join("");
        return route.fulfill(
          xml(
            `<ListPartsResult><Bucket>e2e</Bucket><Key>${key}</Key><UploadId>${uploadId}</UploadId><IsTruncated>false</IsTruncated>${stored}</ListPartsResult>`,
          ),
        );
      }
      case "DELETE":
        if (uploadId) parts.delete(uploadId);
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      default:
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
  });
}
