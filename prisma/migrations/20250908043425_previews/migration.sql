/*
  Warnings:

  - A unique constraint covering the columns `[map_id,z,x,y]` on the table `tile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."tile" ADD COLUMN     "previews" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "tile_map_id_z_x_y_key" ON "public"."tile"("map_id", "z", "x", "y");
