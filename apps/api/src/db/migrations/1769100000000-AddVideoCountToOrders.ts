import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVideoCountToOrders1769100000000 implements MigrationInterface {
    name = 'AddVideoCountToOrders1769100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "videoCount" integer NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "videoCount"`);
    }
}
