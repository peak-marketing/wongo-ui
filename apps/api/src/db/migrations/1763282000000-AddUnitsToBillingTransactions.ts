import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitsToBillingTransactions1763282000000 implements MigrationInterface {
  name = 'AddUnitsToBillingTransactions1763282000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('billing_transactions', 'units');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE "billing_transactions" ADD "units" integer NOT NULL DEFAULT 0`);
    }
    await queryRunner.query(
      `ALTER TABLE "billing_transactions" ALTER COLUMN "status" TYPE varchar(20) USING "status"::varchar(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('billing_transactions', 'units');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "billing_transactions" DROP COLUMN "units"`);
    }
  }
}

