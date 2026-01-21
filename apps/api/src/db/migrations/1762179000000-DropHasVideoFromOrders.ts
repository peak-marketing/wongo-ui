import { MigrationInterface, QueryRunner } from "typeorm";

export class DropHasVideoFromOrders1762179000000 implements MigrationInterface {
    name = 'DropHasVideoFromOrders1762179000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('orders');
        const hasVideoColumn = table?.findColumnByName('hasVideo');
        if (hasVideoColumn) {
            await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "hasVideo"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "hasVideo" boolean NOT NULL DEFAULT false`);
    }
}
