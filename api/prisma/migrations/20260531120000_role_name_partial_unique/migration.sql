-- Role-name uniqueness should ignore soft-deleted rows so a name can be
-- reused after its role is deleted. Replace the full unique index with a
-- partial one. (Prisma can't express partial indexes in the schema — same
-- pattern as the memberships partial unique indexes; enforced at the DB.)

-- DropIndex
DROP INDEX "roles_community_id_name_key";

-- CreateIndex (partial: only active roles must be unique by name)
CREATE UNIQUE INDEX "roles_community_id_name_key"
  ON "roles"("community_id", "name")
  WHERE "deleted_at" IS NULL;
