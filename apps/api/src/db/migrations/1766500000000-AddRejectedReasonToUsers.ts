import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectedReasonToUsers1766500000000 implements MigrationInterface {
  name = 'AddRejectedReasonToUsers1766500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rejectedReason" character varying(500)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "rejectedReason"`);
  }
}
