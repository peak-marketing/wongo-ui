import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeminiStatusKoToOrders1767105000000 implements MigrationInterface {
  name = 'AddGeminiStatusKoToOrders1767105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "geminiStatusKo" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "geminiStatusKo"`);
  }
}
