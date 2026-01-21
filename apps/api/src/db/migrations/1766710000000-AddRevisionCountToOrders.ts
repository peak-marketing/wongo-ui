import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevisionCountToOrders1766710000000 implements MigrationInterface {
  name = 'AddRevisionCountToOrders1766710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "revisionCount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "revisionCount"`);
  }
}
