import { MODULE_METADATA } from '@nestjs/common/constants';
import { WorkerModule } from './worker.module';

describe('WorkerModule', () => {
  it('should declare no HTTP controllers', () => {
    const controllers = (Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      WorkerModule,
    ) ?? []) as unknown[];

    expect(controllers).toHaveLength(0);
  });
});
