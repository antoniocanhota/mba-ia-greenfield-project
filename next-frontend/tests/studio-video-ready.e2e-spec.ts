import type { Page } from "@playwright/test";

import {
  formatDuration,
  processingStatusCopy,
  qualityLabel,
} from "../lib/videos/format";
import { buildVideo } from "../mocks/factories/videos";
import { E2E_STORAGE_ORIGIN } from "../mocks/storage-origin";
import { expect, test } from "./fixtures";

// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW via instrumentation.ts; the reserved id
// readyVid001 answers a `ready` video (metadata + thumbnailUrl) and its media URLs. /api/** is
// only observed, never intercepted.
test.describe("studio-video-ready", () => {
  const PUBLIC_ID = "readyVid001";
  const VIDEO_PATH = `/studio/videos/${PUBLIC_ID}`;
  const MEDIA_PATH = `/api/videos/${PUBLIC_ID}/media-urls`;

  // The fixture the handler answers for readyVid001 (mocks/handlers/videos.ts), built from the
  // shared factory so the expectations are never typed by hand.
  const fixture = buildVideo({
    publicId: PUBLIC_ID,
    filename: "my-video.mp4",
    processingStatus: "ready",
    durationMs: 83_000,
    width: 1920,
    height: 1080,
    thumbnailUrl: `${E2E_STORAGE_ORIGIN}/thumbnails/${PUBLIC_ID}.jpg`,
  });

  async function login(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("user@example.com");
    await page.getByLabel("Password", { exact: true }).fill("secret123");
    const loginResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/auth/login") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    expect((await loginResponse).ok()).toBe(true);
  }

  const pathOf = (r: { url(): string }) => new URL(r.url()).pathname;

  // 1. Reproduzir e baixar o vídeo processado

  test("1.1 video-ready-player-com-controles-e-poster", async ({ page }) => {
    await login(page);
    let mediaRequests = 0;
    let pollRequests = 0;
    page.on("request", (r) => {
      if (pathOf(r) === MEDIA_PATH && r.method() === "GET") mediaRequests += 1;
      if (pathOf(r) === `/api/videos/${PUBLIC_ID}` && r.method() === "GET")
        pollRequests += 1;
    });
    const mediaResponse = page.waitForResponse(
      (r) => pathOf(r) === MEDIA_PATH && r.request().method() === "GET",
    );

    await page.goto(VIDEO_PATH);

    const video = page.locator("video");
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("poster", fixture.thumbnailUrl!);
    const media = await (await mediaResponse).json();
    await expect(video).toHaveAttribute("src", media.streamUrl);

    await expect(page.getByRole("status")).toContainText(
      processingStatusCopy("ready"),
    );
    await expect(
      page.locator(
        `[data-slot='thumb-upload'] img[src='${fixture.thumbnailUrl}']`,
      ),
    ).toHaveCount(1);

    await page.waitForTimeout(4_000);
    expect(mediaRequests).toBe(1);
    expect(pollRequests).toBe(0);
  });

  test("1.2 botao-download-aponta-para-download-url", async ({ page }) => {
    await login(page);

    // The server-rendered HTML is what the browser shows before the media URLs arrive.
    const html = await (await page.request.get(VIDEO_PATH)).text();
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Download<\/button>/);

    const mediaResponse = page.waitForResponse(
      (r) => pathOf(r) === MEDIA_PATH && r.request().method() === "GET",
    );
    await page.goto(VIDEO_PATH);
    const media = await (await mediaResponse).json();

    const download = page.getByRole("link", { name: "Download" });
    await expect(download).toHaveAttribute("href", media.downloadUrl);
    await expect(download.locator("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    // The button sits below the VideoLink inside the details card.
    const card = page.locator("[data-slot='video-details-card']");
    const linkBox = await card
      .locator("[data-slot='video-details-link']")
      .boundingBox();
    const downloadBox = await download.boundingBox();
    expect(downloadBox!.y).toBeGreaterThan(linkBox!.y);
  });

  test("1.3 duracao-e-qualidade-formatadas", async ({ page }) => {
    await login(page);

    await page.goto(VIDEO_PATH);

    const card = page.locator("[data-slot='video-details-card']");
    await expect(
      card.getByText(formatDuration(fixture.durationMs)),
    ).toBeVisible();
    await expect(
      card.getByText(qualityLabel(fixture.width, fixture.height)),
    ).toBeVisible();
    await expect(card.getByText(fixture.filename)).toBeVisible();
  });

  // 2. Gate de autenticação do studio

  test("2.1 anonimo-redirecionado-para-login", async ({ page }) => {
    let mediaRequests = 0;
    page.on("request", (r) => {
      if (pathOf(r) === MEDIA_PATH) mediaRequests += 1;
    });

    await page.goto(VIDEO_PATH);

    await expect(page).toHaveURL(/\/login$/);
    expect(mediaRequests).toBe(0);
  });
});
