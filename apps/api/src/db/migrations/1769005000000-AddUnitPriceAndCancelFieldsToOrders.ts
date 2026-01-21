import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitPriceAndCancelFieldsToOrders1769005000000 implements MigrationInterface {
  name = 'AddUnitPriceAndCancelFieldsToOrders1769005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "unitPrice" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "chargedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelReason" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelReason"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "canceledAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelRequestedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "chargedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "unitPrice"`);
  }
}
