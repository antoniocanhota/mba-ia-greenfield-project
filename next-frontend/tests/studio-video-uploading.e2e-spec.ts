import type { Page, Route } from "@playwright/test";

import { E2E_STORAGE_ORIGIN } from "../mocks/storage-origin";
import { failureReasonCopy, processingStatusCopy } from "../lib/videos/format";
import { expect, test } from "./fixtures";

// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW via instrumentation.ts: the video handlers keep a
// lifecycle store per publicId (awaiting_upload → uploaded) and answer the reserved ids
// missingVid1 / failedVid01 / procVid0001. /api/** is only observed, never intercepted.
// The one browser-side hook is the storage origin: parts are held on a test-level route that
// falls back to the shared storage fake (e2e-video-upload-fixtures/TD-01).
test.describe("studio-video-uploading", () => {
  const MIB = 1024 * 1024;

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

  // Holds every part PUT on the reserved storage origin until the test releases it.
  async function holdStorageParts(page: Page) {
    const pending: Array<() => void> = [];
    let released = false;
    await page.route(`${E2E_STORAGE_ORIGIN}/**`, async (route: Route) => {
      if (route.request().method() === "PUT" && !released) {
        await new Promise<void>((resolve) => pending.push(resolve));
      }
      await route.fallback();
    });
    return {
      pendingCount: () => pending.length,
      releaseNext: () => pending.shift()?.(),
      releaseAll: () => {
        released = true;
        pending.splice(0).forEach((resolve) => resolve());
      },
    };
  }

  // React puts its props on a DOM node once it hydrated it: before that, handlers do not exist.
  async function waitForHydration(page: Page, testId: string) {
    await page.waitForFunction((id) => {
      const el = document.querySelector(`[data-testid='${id}']`);
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    }, testId);
  }

  const pathOf = (r: { url(): string }) => new URL(r.url()).pathname;
  const isCreateDraft = (r: { url(): string; method(): string }) =>
    pathOf(r) === "/api/videos" && r.method() === "POST";

  async function startUpload(
    page: Page,
    name = "my-video.mp4",
    size = 12 * MIB,
  ) {
    await page.goto("/studio/upload");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Select file" }).click();
    await (
      await chooser
    ).setFiles({
      name,
      mimeType: "video/mp4",
      buffer: Buffer.alloc(size, 1),
    });
    // Client navigation to a dev-server RSC route can be slow under parallel workers.
    await expect(page).toHaveURL(/\/studio\/videos\/[^/]+$/, {
      timeout: 15_000,
    });
    return new URL(page.url()).pathname.split("/").pop()!;
  }

  // 1. Acompanhar o envio e o status do vídeo

  test("1.1 progresso-do-upload-e-status-apos-conclusao", async ({ page }) => {
    // Multi-part upload with held parts plus cold dev-server routes: more than the 30s default.
    test.setTimeout(60_000);
    await login(page);
    const storage = await holdStorageParts(page);
    const signatures: string[] = [];
    const partPuts: string[] = [];
    page.on("request", (r) => {
      if (/\/upload-signatures$/.test(pathOf(r)) && r.method() === "POST")
        signatures.push(pathOf(r));
      if (r.url().startsWith(E2E_STORAGE_ORIGIN) && r.method() === "PUT")
        partPuts.push(r.url());
    });

    const publicId = await startUpload(page);

    await expect(
      page.getByRole("heading", { name: "Video details" }),
    ).toBeVisible();
    await expect(page.getByText("my-video.mp4").first()).toBeVisible();

    // Text and bar always carry the same value.
    const progressText = page.locator("[data-slot='upload-progress-text']");
    await expect(progressText).toBeVisible();
    const readPercent = async () =>
      Number(/(\d+)%/.exec((await progressText.textContent()) ?? "")?.[1]);
    const bar = page.getByRole("progressbar");
    await expect(async () => {
      expect(await bar.getAttribute("aria-valuenow")).toBe(
        String(await readPercent()),
      );
    }).toPass();

    // Parts are held at the storage fake: release them one at a time to see the percentage grow.
    await expect.poll(() => storage.pendingCount()).toBeGreaterThan(0);
    const first = await readPercent();
    storage.releaseNext();
    await expect.poll(readPercent).toBeGreaterThan(first);
    expect(partPuts.length).toBeGreaterThan(0);
    expect(signatures.length).toBeGreaterThan(0);
    expect(signatures.every((p) => p.includes(publicId))).toBe(true);

    // Marker survives only if the document is not reloaded.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });
    const completion = page.waitForResponse(
      (r) =>
        pathOf(r) === `/api/videos/${publicId}/upload-completion` &&
        r.request().method() === "POST",
    );
    storage.releaseAll();
    const completionResponse = await completion;
    expect(completionResponse.status()).toBe(200);
    expect((await completionResponse.json()).processingStatus).toBe("uploaded");

    await expect(page.getByText("Uploading", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      processingStatusCopy("uploaded"),
    );
    expect(
      await page.evaluate(
        () => (window as unknown as { __noReload?: boolean }).__noReload,
      ),
    ).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/studio/videos/${publicId}$`));

    const poll = await page.waitForResponse(
      (r) =>
        pathOf(r) === `/api/videos/${publicId}` &&
        r.request().method() === "GET",
    );
    expect((await poll.json()).processingStatus).toBe("uploaded");
    await expect(
      page.getByText("Envio interrompido — selecione o arquivo novamente"),
    ).toHaveCount(0);
  });

  test("1.2 video-em-processamento-mostra-status", async ({ page }) => {
    await login(page);
    const polls: number[] = [];
    page.on("request", (r) => {
      if (pathOf(r) === "/api/videos/procVid0001" && r.method() === "GET")
        polls.push(Date.now());
    });

    await page.goto("/studio/videos/procVid0001");

    const status = page.getByRole("status");
    await expect(status).toContainText(processingStatusCopy("processing"));
    await expect(
      page.getByText("Envio interrompido — selecione o arquivo novamente"),
    ).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toHaveCount(0);

    await expect
      .poll(() => polls.length, { timeout: 25_000 })
      .toBeGreaterThanOrEqual(2);
    for (let i = 1; i < polls.length; i += 1) {
      expect(polls[i] - polls[i - 1]).toBeGreaterThanOrEqual(2_500);
    }
  });

  test("1.3 reload-mostra-envio-interrompido-e-reanexa", async ({ page }) => {
    await login(page);
    const storage = await holdStorageParts(page);
    // Held parts keep the upload in progress regardless of size: a small file keeps this cheap.
    const publicId = await startUpload(page, "my-video.mp4", 1024);

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByText("Envio interrompido — selecione o arquivo novamente"),
    ).toBeVisible();
    await expect(page.getByTestId("reattach-input")).toBeAttached();
    await expect(page.getByRole("progressbar")).toHaveCount(0);

    let createCalls = 0;
    const signatures: string[] = [];
    page.on("request", (r) => {
      if (isCreateDraft(r)) createCalls += 1;
      if (/\/upload-signatures$/.test(pathOf(r)) && r.method() === "POST")
        signatures.push(pathOf(r));
    });

    await waitForHydration(page, "reattach-input");
    await page.getByTestId("reattach-input").setInputFiles({
      name: "my-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1024, 1),
    });

    // The storage fake stays held until the panel is asserted, so the upload cannot finish first.
    await expect(
      page.locator("[data-slot='upload-progress-text']"),
    ).toContainText(/Uploading\.\.\. \d+%/);
    expect(createCalls).toBe(0);
    expect(signatures.length).toBeGreaterThan(0);
    expect(
      signatures.every(
        (p) => p === `/api/videos/${publicId}/upload-signatures`,
      ),
    ).toBe(true);

    storage.releaseAll();
  });

  test("1.4 video-failed-mostra-motivo-e-link", async ({ page }) => {
    await login(page);
    let polls = 0;
    page.on("request", (r) => {
      if (pathOf(r) === "/api/videos/failedVid01" && r.method() === "GET")
        polls += 1;
    });

    await page.goto("/studio/videos/failedVid01");

    await expect(
      page.getByText(failureReasonCopy("not_a_video")),
    ).toBeVisible();
    await expect(page.locator("a[href='/studio/upload']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Select file" })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("reattach-input")).toHaveCount(0);

    await page.waitForTimeout(4_000);
    expect(polls).toBe(0);
  });

  test("1.5 video-alheio-ou-inexistente-404", async ({ page }) => {
    await login(page);

    const response = await page.goto("/studio/videos/missingVid1");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Video details" }),
    ).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.locator("[data-slot='video-details-link']")).toHaveCount(
      0,
    );
  });

  test("1.6 video-link-copiavel-sem-navegacao", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await login(page);

    await page.goto("/studio/videos/procVid0001");

    const origin = new URL(page.url()).origin;
    const expected = `${origin}/v/procVid0001`;
    const link = page.locator("[data-slot='video-details-link']");
    await expect(link).toHaveText(expected);
    await expect(page.locator("a[href*='/v/']")).toHaveCount(0);

    await page.getByRole("button", { name: "Copy link" }).click();

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(expected);
    await expect(page).toHaveURL(/\/studio\/videos\/procVid0001$/);
  });

  // 2. Gate de autenticação do studio

  test("2.1 anonimo-redirecionado-para-login", async ({ page }) => {
    await page.goto("/studio/videos/procVid0001");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("[data-slot='video-details-link']")).toHaveCount(
      0,
    );
  });
});
