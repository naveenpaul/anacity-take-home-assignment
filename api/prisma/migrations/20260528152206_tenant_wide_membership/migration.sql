/*
  Warnings:

  - Added the required column `tenant_id` to the `memberships` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "memberships_user_id_community_id_key";

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "tenant_id" UUID NOT NULL,
ALTER COLUMN "community_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "memberships_user_id_tenant_id_idx" ON "memberships"("user_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restore per-community uniqueness (lost when dropping the old composite unique
-- index) and add tenant-wide uniqueness. Two partial indexes are required
-- because the unique key shape depends on whether community_id is set.
CREATE UNIQUE INDEX "memberships_user_id_community_id_key"
  ON "memberships"("user_id", "community_id")
  WHERE "community_id" IS NOT NULL;

CREATE UNIQUE INDEX "memberships_user_id_tenant_id_tenant_wide_key"
  ON "memberships"("user_id", "tenant_id")
  WHERE "community_id" IS NULL;
