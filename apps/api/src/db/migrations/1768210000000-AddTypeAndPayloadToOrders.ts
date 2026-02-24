import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTypeAndPayloadToOrders1768210000000 implements MigrationInterface {
  name = 'AddTypeAndPayloadToOrders1768210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'MANUSCRIPT'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payload" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "payload"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "type"`);
  }
}
