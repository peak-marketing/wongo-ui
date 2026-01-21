import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1762173730121 implements MigrationInterface {
    name = 'InitialSchema1762173730121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('AGENCY', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'AGENCY', "status" "public"."users_status_enum" NOT NULL DEFAULT 'PENDING', "businessName" character varying NOT NULL, "businessRegNo" character varying NOT NULL, "displayName" character varying, "name" character varying, "agencyId" character varying, "approvedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'ADMIN_INTAKE', 'GENERATING', 'GENERATED', 'ADMIN_REVIEW', 'AGENCY_REVIEW', 'COMPLETE', 'AGENCY_REJECTED', 'ADMIN_REJECTED', 'REVISION_REQUESTED', 'REGEN_QUEUED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."orders_status_enum" NOT NULL DEFAULT 'DRAFT', "agencyId" uuid NOT NULL, "placeName" character varying NOT NULL, "placeAddress" character varying, "searchKeywords" character varying, "guideContent" text, "requiredKeywords" text, "emphasisKeywords" text, "hasLink" boolean NOT NULL DEFAULT false, "hasMap" boolean NOT NULL DEFAULT false, "hasVideo" boolean NOT NULL DEFAULT false, "hashtags" text, "referenceReviews" text, "notes" text, "photos" text, "personaSnapshot" text, "personaId" character varying, "manuscript" text, "validationReport" text, "rejectionReason" text, "extraInstruction" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "billing_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "orderId" uuid, "type" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a45fef3891676a469e922771025" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "balance" numeric(10,2) NOT NULL DEFAULT '0', "reserved" numeric(10,2) NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2ecdb33f23e9a6fc392025c0b97" UNIQUE ("userId"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_f8eb3c97435074c510c0117cdaf" FOREIGN KEY ("agencyId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "billing_transactions" ADD CONSTRAINT "FK_3ff321f6ef3eab5ef856ec4f469" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "billing_transactions" ADD CONSTRAINT "FK_fbb260d9d2c6daa835c21617efb" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97"`);
        await queryRunner.query(`ALTER TABLE "billing_transactions" DROP CONSTRAINT "FK_fbb260d9d2c6daa835c21617efb"`);
        await queryRunner.query(`ALTER TABLE "billing_transactions" DROP CONSTRAINT "FK_3ff321f6ef3eab5ef856ec4f469"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_f8eb3c97435074c510c0117cdaf"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`DROP TABLE "billing_transactions"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
