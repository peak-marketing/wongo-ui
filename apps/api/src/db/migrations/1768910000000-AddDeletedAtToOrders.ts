import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedAtToOrders1768910000000 implements MigrationInterface {
  name = 'AddDeletedAtToOrders1768910000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "deletedAt"`);
  }
}
