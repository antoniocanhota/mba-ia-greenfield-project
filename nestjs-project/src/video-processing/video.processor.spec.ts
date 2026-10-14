import type { Job } from 'bullmq';
import { PROCESS_VIDEO_JOB, SWEEP_VIDEOS_JOB } from '../queue/queue.constants';
import { VideoProcessingService } from './video-processing.service';
import { VideoProcessor } from './video.processor';

const jobOf = (
  name: string,
  attemptsMade: number,
  attempts: number | undefined = 3,
) =>
  ({
    name,
    data: { videoId: 'video-1' },
    attemptsMade,
    opts: { attempts },
    updateProgress: jest.fn().mockResolvedValue(undefined),
  }) as unknown as Job<{ videoId: string }>;

describe('VideoProcessor', () => {
  let processing: { process: jest.Mock };
  let processor: VideoProcessor;

  beforeEach(() => {
    processing = { process: jest.fn().mockResolvedValue(undefined) };
    processor = new VideoProcessor(
      processing as unknown as VideoProcessingService,
    );
  });

  it.each([
    [0, false],
    [1, false],
    [2, true],
  ])(
    'should flag isFinalAttempt from attemptsMade=%d of 3 as %s',
    async (attemptsMade, isFinalAttempt) => {
      await processor.process(jobOf(PROCESS_VIDEO_JOB, attemptsMade));

      expect(processing.process).toHaveBeenCalledWith(
        'video-1',
        expect.objectContaining({ isFinalAttempt }),
      );
    },
  );

  it('should treat a job without attempts option as a single, final attempt', async () => {
    const job = jobOf(PROCESS_VIDEO_JOB, 0);
    job.opts.attempts = undefined;

    await processor.process(job);

    expect(processing.process).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({ isFinalAttempt: true }),
    );
  });

  it('should forward progress to the job', async () => {
    const job = jobOf(PROCESS_VIDEO_JOB, 0);
    const updateProgress = jest.fn().mockResolvedValue(undefined);
    job.updateProgress = updateProgress;
    processing.process.mockImplementation(
      async (
        _id: string,
        { onProgress }: { onProgress: (n: number) => Promise<void> },
      ) => onProgress(40),
    );

    await processor.process(job);

    expect(updateProgress).toHaveBeenCalledWith(40);
  });

  it('should ignore job kinds other than process-video', async () => {
    await processor.process(jobOf(SWEEP_VIDEOS_JOB, 0));

    expect(processing.process).not.toHaveBeenCalled();
  });
});
