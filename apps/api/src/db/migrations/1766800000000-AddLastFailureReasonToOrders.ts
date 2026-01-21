import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastFailureReasonToOrders1766800000000 implements MigrationInterface {
  name = 'AddLastFailureReasonToOrders1766800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lastFailureReason" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "lastFailureReason"`);
  }
}
