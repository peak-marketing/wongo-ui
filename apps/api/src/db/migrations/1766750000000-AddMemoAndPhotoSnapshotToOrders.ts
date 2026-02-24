import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemoAndPhotoSnapshotToOrders1766750000000 implements MigrationInterface {
  name = 'AddMemoAndPhotoSnapshotToOrders1766750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "adminMemo" text`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "revisionMemo" text`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "photoSnapshot" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "photoSnapshot"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "revisionMemo"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "adminMemo"`);
  }
}
