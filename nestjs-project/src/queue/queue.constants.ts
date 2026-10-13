export const VIDEOS_QUEUE = 'videos';
export const PROCESS_VIDEO_JOB = 'process-video';
export const SWEEP_VIDEOS_JOB = 'sweep-videos';

// Idempotent enqueue relies on jobId = video id; retries absorb transient worker failures.
export const PROCESS_VIDEO_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
} as const;
