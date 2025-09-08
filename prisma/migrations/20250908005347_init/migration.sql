-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Map" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserMap" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "map_id" TEXT NOT NULL,

    CONSTRAINT "UserMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tile" (
    "id" SERIAL NOT NULL,
    "z" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "map_id" TEXT NOT NULL,

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Map_id_idx" ON "public"."Map"("id");

-- CreateIndex
CREATE INDEX "UserMap_user_id_idx" ON "public"."UserMap"("user_id");

-- CreateIndex
CREATE INDEX "UserMap_map_id_idx" ON "public"."UserMap"("map_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserMap_user_id_map_id_key" ON "public"."UserMap"("user_id", "map_id");

-- CreateIndex
CREATE INDEX "Tile_map_id_idx" ON "public"."Tile"("map_id");

-- CreateIndex
CREATE INDEX "Tile_z_x_y_idx" ON "public"."Tile"("z", "x", "y");

-- CreateIndex
CREATE INDEX "Tile_map_id_z_x_y_idx" ON "public"."Tile"("map_id", "z", "x", "y");

-- AddForeignKey
ALTER TABLE "public"."Map" ADD CONSTRAINT "Map_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMap" ADD CONSTRAINT "UserMap_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMap" ADD CONSTRAINT "UserMap_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "public"."Map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tile" ADD CONSTRAINT "Tile_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "public"."Map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
