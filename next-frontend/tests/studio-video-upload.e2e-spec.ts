import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// 1 spec → 1 file with one describe (feature = target_file stem) + N test() blocks.
// Upstream is faked server-side by mocks/ MSW via instrumentation.ts; the only reserved trigger
// used here is filename "too-large.mp4" → 400 VALIDATION_ERROR on POST /videos. No page.route()
// of /api/** — the object storage fake is applied by the `network` fixture.
test.describe("studio-video-upload", () => {
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

  // Scoped to the dropzone: Next's route announcer also has role="alert".
  const inlineError = (page: Page) =>
    page.locator("[data-slot='upload-dropzone']").getByRole("alert");

  async function selectFile(
    page: Page,
    file: { name: string; mimeType: string; buffer: Buffer },
  ) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Select file" }).click();
    await (await chooser).setFiles(file);
  }

  const isCreateDraft = (r: { url(): string; method(): string }) =>
    new URL(r.url()).pathname === "/api/videos" && r.method() === "POST";

  // 1. Pré-cadastrar o vídeo e iniciar o envio

  test("1.1 arquivo-valido-cria-rascunho-e-redireciona", async ({ page }) => {
    await login(page);
    await page.goto("/studio/upload");

    await expect(
      page.getByRole("heading", { name: "Upload Video" }),
    ).toBeVisible();
    await expect(
      page.getByText("Drag and drop a video file to upload"),
    ).toBeVisible();
    await expect(
      page.getByText("Your videos will be private until you publish them."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Select file" }),
    ).toBeVisible();

    const buffer = Buffer.from("fake-video-bytes");
    const createRequest = page.waitForRequest(isCreateDraft);
    await selectFile(page, {
      name: "my-video.mp4",
      mimeType: "video/mp4",
      buffer,
    });

    const request = await createRequest;
    expect(request.postDataJSON()).toEqual({
      filename: "my-video.mp4",
      sizeBytes: buffer.length,
      contentType: "video/mp4",
    });
    await expect(
      page.getByRole("button", { name: "Select file" }),
    ).toBeDisabled();

    // Client navigation to a dev-server RSC route can be slow under parallel workers.
    await expect(page).toHaveURL(/\/studio\/videos\/[^/]+$/, {
      timeout: 15_000,
    });
    // The name appears in the progress panel and in the details card.
    await expect(page.getByText("my-video.mp4").first()).toBeVisible();
  });

  test("1.2 arquivo-nao-video-erro-inline-sem-bff", async ({ page }) => {
    await login(page);
    await page.goto("/studio/upload");

    let createCalls = 0;
    page.on("request", (r) => {
      if (isCreateDraft(r)) createCalls += 1;
    });

    await selectFile(page, {
      name: "notes.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a video"),
    });
    await expect(inlineError(page)).toBeVisible();
    await expect(page).toHaveURL(/\/studio\/upload$/);

    await selectFile(page, {
      name: `${"a".repeat(252)}.mp4`,
      mimeType: "video/mp4",
      buffer: Buffer.from("fake-video-bytes"),
    });
    await expect(inlineError(page)).toBeVisible();

    expect(createCalls).toBe(0);
  });

  test("1.3 falha-no-pre-cadastro-erro-inline-e-nova-tentativa", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/studio/upload");

    const file = {
      name: "too-large.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake-video-bytes"),
    };

    const firstResponse = page.waitForResponse((r) =>
      isCreateDraft(r.request()),
    );
    await selectFile(page, file);
    expect((await firstResponse).status()).toBe(400);
    await expect(inlineError(page)).toBeVisible();
    await expect(page).toHaveURL(/\/studio\/upload$/);

    const secondRequest = page.waitForRequest(isCreateDraft);
    await expect(
      page.getByRole("button", { name: "Select file" }),
    ).toBeEnabled();
    await selectFile(page, file);
    await secondRequest;
  });

  // 2. Gate de autenticação do studio

  test("2.1 anonimo-redirecionado-para-login", async ({ page }) => {
    let createCalls = 0;
    page.on("request", (r) => {
      if (isCreateDraft(r)) createCalls += 1;
    });

    await page.goto("/studio/upload");

    await expect(page).toHaveURL(/\/login$/);
    expect(createCalls).toBe(0);
  });
});
