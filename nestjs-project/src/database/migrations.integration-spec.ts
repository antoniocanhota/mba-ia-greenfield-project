import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { Video } from '../videos/entities/video.entity';
import { CreateUsersAndChannels1775687773260 } from './migrations/1775687773260-CreateUsersAndChannels';
import { CreateAuthTokens1777579850478 } from './migrations/1777579850478-CreateAuthTokens';
import { CreateVideos1791916388634 } from './migrations/1791916388634-CreateVideos';
import { AddVideoTitle1792080446571 } from './migrations/1792080446571-AddVideoTitle';
import { createTestDataSource } from '../test/create-test-data-source';

const MANAGED_TABLES = [
  'users',
  'channels',
  'refresh_tokens',
  'verification_tokens',
  'videos',
];

// Enum types survive DROP TABLE; suites that synchronize leave them behind.
const MANAGED_TYPES = [
  'verification_tokens_type_enum',
  'video_processing_status',
  'video_publication_status',
  'video_failure_reason',
];

describe('Database migrations (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createTestDataSource(
      [User, Channel, RefreshToken, VerificationToken, Video],
      {
        synchronize: false,
        migrations: [
          CreateUsersAndChannels1775687773260,
          CreateAuthTokens1777579850478,
          CreateVideos1791916388634,
          AddVideoTitle1792080446571,
        ],
      },
    );

    await dataSource.initialize();

    // Sequential: parallel DROP ... CASCADE on FK-linked tables deadlocks.
    for (const table of [...MANAGED_TABLES, 'migrations']) {
      await dataSource.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    for (const type of MANAGED_TYPES) {
      await dataSource.query(`DROP TYPE IF EXISTS "${type}"`);
    }
  });

  afterAll(async () => {
    // The last test undoes the video migrations, leaving the videos table missing.
    // Re-apply so the shared DB is fully migrated when subsequent suites run.
    await dataSource.runMigrations();
    await dataSource.destroy();
  });

  it('should apply all migrations and create all five tables', async () => {
    const ranMigrations = await dataSource.runMigrations();

    expect(ranMigrations).toHaveLength(4);

    const result = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [MANAGED_TABLES],
    );
    const tableNames = result.map((r) => r.table_name);
    expect(tableNames).toEqual([
      'channels',
      'refresh_tokens',
      'users',
      'verification_tokens',
      'videos',
    ]);
  });

  it('should revert AddVideoTitle and drop only the title column', async () => {
    await dataSource.undoLastMigration();

    const columns = await dataSource.query<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'videos'
         AND column_name = ANY($1::text[])`,
      [['title', 'original_filename']],
    );
    expect(columns.map((c) => c.column_name)).toEqual(['original_filename']);
  });

  it('should backfill title from original_filename when AddVideoTitle runs on existing rows', async () => {
    const user = await dataSource
      .getRepository(User)
      .save({ email: 'migration@example.com', password: 'hashed' });
    const channel = await dataSource
      .getRepository(Channel)
      .save({ name: 'Migration', nickname: 'migration', user_id: user.id });
    const filenames = ['clip.final.mp4', '.mp4', 'semextensao'];
    for (const [index, filename] of filenames.entries()) {
      await dataSource.query(
        `INSERT INTO "videos" ("public_id", "channel_id", "original_filename")
         VALUES ($1, $2, $3)`,
        [`migration0${index}`, channel.id, filename],
      );
    }

    const ranMigrations = await dataSource.runMigrations();

    expect(ranMigrations.map((m) => m.name)).toEqual([
      'AddVideoTitle1792080446571',
    ]);
    const rows = await dataSource.query<
      { original_filename: string; title: string }[]
    >(`SELECT "original_filename", "title" FROM "videos" ORDER BY "public_id"`);
    expect(rows).toEqual([
      { original_filename: 'clip.final.mp4', title: 'clip.final' },
      { original_filename: '.mp4', title: '.mp4' },
      { original_filename: 'semextensao', title: 'semextensao' },
    ]);
    const [titleColumn] = await dataSource.query<{ is_nullable: string }[]>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'videos'
         AND column_name = 'title'`,
    );
    expect(titleColumn.is_nullable).toBe('NO');

    await dataSource.query('DELETE FROM "videos"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  it('should revert the video migrations and remove the videos table and enums', async () => {
    await dataSource.undoLastMigration();
    await dataSource.undoLastMigration();

    const tables = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'videos'`,
    );
    expect(tables).toHaveLength(0);

    const types = await dataSource.query<{ typname: string }[]>(
      `SELECT typname FROM pg_type WHERE typname = ANY($1::text[])`,
      [MANAGED_TYPES.filter((type) => type.startsWith('video_'))],
    );
    expect(types).toHaveLength(0);

    const tokenTables = await dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [['refresh_tokens', 'verification_tokens']],
    );
    expect(tokenTables).toHaveLength(2);
  });
});
