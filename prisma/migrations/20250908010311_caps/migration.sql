/*
  Warnings:

  - You are about to drop the `Map` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserMap` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Map" DROP CONSTRAINT "Map_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Tile" DROP CONSTRAINT "Tile_map_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserMap" DROP CONSTRAINT "UserMap_map_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserMap" DROP CONSTRAINT "UserMap_user_id_fkey";

-- DropTable
DROP TABLE "public"."Map";

-- DropTable
DROP TABLE "public"."Tile";

-- DropTable
DROP TABLE "public"."UserMap";

-- CreateTable
CREATE TABLE "public"."map" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_map" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,

    CONSTRAINT "user_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tile" (
    "id" SERIAL NOT NULL,
    "z" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "map_id" TEXT NOT NULL,

    CONSTRAINT "tile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "map_id_idx" ON "public"."map"("id");

-- CreateIndex
CREATE INDEX "user_map_user_id_idx" ON "public"."user_map"("user_id");

-- CreateIndex
CREATE INDEX "user_map_map_id_idx" ON "public"."user_map"("map_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_map_user_id_map_id_key" ON "public"."user_map"("user_id", "map_id");

-- CreateIndex
CREATE INDEX "tile_map_id_idx" ON "public"."tile"("map_id");

-- CreateIndex
CREATE INDEX "tile_z_x_y_idx" ON "public"."tile"("z", "x", "y");

-- CreateIndex
CREATE INDEX "tile_map_id_z_x_y_idx" ON "public"."tile"("map_id", "z", "x", "y");

-- AddForeignKey
ALTER TABLE "public"."map" ADD CONSTRAINT "map_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_map" ADD CONSTRAINT "user_map_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_map" ADD CONSTRAINT "user_map_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tile" ADD CONSTRAINT "tile_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
