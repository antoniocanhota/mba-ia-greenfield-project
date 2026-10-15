export const VIDEOS_QUEUE = 'videos';
// BullMQ's own default key prefix; tests override it so the dev worker never sees their jobs.
export const DEFAULT_QUEUE_PREFIX = 'bull';
export const PROCESS_VIDEO_JOB = 'process-video';
export const SWEEP_VIDEOS_JOB = 'sweep-videos';

// Idempotent enqueue relies on jobId = video id; retries absorb transient worker failures.
export const PROCESS_VIDEO_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
} as const;

// One repeatable scheduler (upserted by ID at worker boot) triggers the sweep job.
export const SWEEP_SCHEDULER_ID = 'sweep-videos';
export const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
