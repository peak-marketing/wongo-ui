import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultUnitPriceToUsers1766501000000 implements MigrationInterface {
  name = 'AddDefaultUnitPriceToUsers1766501000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultUnitPrice" integer NOT NULL DEFAULT 0`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "defaultUnitPrice"`);
  }
}
