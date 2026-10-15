// Jest setup file (runs after `dotenv/config`): every test process uses its own
// BullMQ key prefix, so the dev `video-worker` sharing the same Redis never
// consumes jobs enqueued by tests (phase-03-videos/TD-02, revision 2026-10-15).
export const TEST_QUEUE_PREFIX = 'streamtube-test';

process.env.QUEUE_PREFIX = TEST_QUEUE_PREFIX;
