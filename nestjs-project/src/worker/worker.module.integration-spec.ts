import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { WorkerModule } from './worker.module';

describe('WorkerModule (integration)', () => {
  it('should compile against the real db, queue and storage without HTTP or bucket initializer', async () => {
    const module = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    expect(module.get(DataSource).isInitialized).toBe(true);
    expect(module.get(StorageService)).toBeDefined();
    await module.close();
  }, 30000);
});
