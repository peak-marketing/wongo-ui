import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceUrlToOrders1767000000000 implements MigrationInterface {
  name = 'AddPlaceUrlToOrders1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "placeUrl" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "placeUrl"`);
  }
}
