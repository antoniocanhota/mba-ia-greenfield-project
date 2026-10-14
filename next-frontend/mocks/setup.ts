import { afterAll, afterEach, beforeAll } from "vitest";
import { resetVideoStore } from "./handlers/videos";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetVideoStore();
});
afterAll(() => server.close());
