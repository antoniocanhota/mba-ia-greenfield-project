// Fake object-storage origin used by the video mocks. Deliberately free of imports (no
// `env`) so the Playwright runner on the host can import it to route the storage fake.
// `.invalid` is reserved (RFC 2606): it can never resolve to a real host.
export const E2E_STORAGE_ORIGIN = "http://storage.e2e.invalid";
