-- CreateTable
CREATE TABLE "monitor_visibility" (
    "id" SERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "monitor_name" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "monitor_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitor_visibility_monitor_id_key" ON "monitor_visibility"("monitor_id");

-- CreateIndex
CREATE INDEX "monitor_visibility_monitor_name_idx" ON "monitor_visibility"("monitor_name");

-- CreateIndex
CREATE INDEX "monitor_visibility_is_public_idx" ON "monitor_visibility"("is_public");

-- AddForeignKey
ALTER TABLE "monitor_visibility" ADD CONSTRAINT "monitor_visibility_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;