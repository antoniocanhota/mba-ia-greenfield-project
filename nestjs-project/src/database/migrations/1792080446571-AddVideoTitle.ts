import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVideoTitle1792080446571 implements MigrationInterface {
  name = 'AddVideoTitle1792080446571';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "title" character varying(255)`,
    );
    // Backfill: the original filename without its last extension, or the full
    // filename when stripping leaves nothing (e.g. ".mp4"). Same rule as
    // titleFromFilename() in the videos module.
    await queryRunner.query(
      `UPDATE "videos" SET "title" = COALESCE(NULLIF(regexp_replace("original_filename", '\\.[^.]*$', ''), ''), "original_filename") WHERE "title" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ALTER COLUMN "title" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP COLUMN IF EXISTS "title"`,
    );
  }
}
