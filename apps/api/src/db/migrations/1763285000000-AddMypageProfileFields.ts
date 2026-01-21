import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMypageProfileFields1763285000000 implements MigrationInterface {
  name = 'AddMypageProfileFields1763285000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contactName" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" character varying(16)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyName" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refundBank" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refundHolder" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refundAccount" character varying(40)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refundAccount"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refundHolder"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refundBank"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "companyName"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "contactName"`);
  }
}

