import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompletedAtToOrders1762175250000 implements MigrationInterface {
    name = 'AddCompletedAtToOrders1762175250000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "completedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "completedAt"`);
    }
}
