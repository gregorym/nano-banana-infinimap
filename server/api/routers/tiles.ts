import { generateGridPreview } from "@/lib/generator";
import { prisma } from "@/lib/prisma";
import { generatePreviewKey, generateTileKey, uploadImageToS3 } from "@/lib/s3";
import { blake2sHex } from "@/lib/hashing";
import { TILE, parentOf } from "@/lib/coords";
import sharp from "sharp";
import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const tilesRouter = createTRPCRouter({
  all: publicProcedure
    .input(
      z.object({
        mapId: z.string(),
        page: z.number().default(0),
        count: z.number().default(100),
      })
    )
    .query(() => {}),
  preview: publicProcedure
    .input(
      z.object({
        mapId: z.string(),
        z: z.number(),
        x: z.number(),
        y: z.number(),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const finalComposite = await generateGridPreview(
        input.z,
        input.x,
        input.y,
        input.prompt ?? ""
      );

      if (finalComposite) {
        // Upload the generated image to S3
        const tileKey = generatePreviewKey(
          input.mapId,
          input.z,
          input.x,
          input.y
        );
        const imageUrl = await uploadImageToS3({
          buffer: finalComposite,
          key: tileKey,
          contentType: "image/webp",
        });

        // Update the tile with the S3 URL
        const finalTile = await prisma.tile.findFirst({
          where: {
            mapId: input.mapId,
            z: input.z,
            x: input.x,
            y: input.y,
          },
        });

        if (finalTile) {
          return await prisma.tile.update({
            where: { id: finalTile.id },
            data: {
              previews: [...finalTile.previews, imageUrl],
            },
          });
        } else {
          return await prisma.tile.create({
            data: {
              mapId: input.mapId,
              z: input.z,
              x: input.x,
              y: input.y,
              previews: [imageUrl],
            },
          });
        }
      }

      // Return the tile (either updated with URL or just the base tile)
      return await prisma.tile.findFirst({
        where: {
          mapId: input.mapId,
          z: input.z,
          x: input.x,
          y: input.y,
        },
      });
    }),

  confirmPreview: publicProcedure
    .input(
      z.object({
        mapId: z.string(),
        z: z.number(),
        x: z.number(), // center tile
        y: z.number(), // center tile
        previewUrl: z.string(),
        selectedPositions: z.array(z.object({
          x: z.number(),
          y: z.number(),
        })).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { mapId, z, x: centerX, y: centerY, previewUrl, selectedPositions } = input;
      
      // Find the preview tile to get the preview buffer
      const previewTile = await prisma.tile.findFirst({
        where: { mapId, z, x: centerX, y: centerY },
      });

      if (!previewTile?.previews.length) {
        throw new Error("Preview not found");
      }

      // For now, we'll assume the preview is the latest one
      const latestPreview = previewTile.previews[previewTile.previews.length - 1];
      
      // Fetch the preview image from S3 URL
      const response = await fetch(latestPreview);
      if (!response.ok) {
        throw new Error("Failed to fetch preview image");
      }
      const compositeBuffer = Buffer.from(await response.arrayBuffer());

      // Extract individual tiles from the composite
      const genTiles = await extractTiles(compositeBuffer);
      const selectedSet = selectedPositions?.length 
        ? new Set(selectedPositions.map(p => `${p.x},${p.y}`))
        : null;

      // Create circular gradient mask for blending
      const mask3x3 = await createCircularGradientMask(TILE);

      const updatedTiles: Array<{ x: number; y: number; url: string }> = [];

      // Process each tile in the 3x3 grid
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tileX = centerX + dx;
          const tileY = centerY + dy;
          const genTile = genTiles[dy + 1][dx + 1];

          // Check if this position should be updated
          if (selectedSet && !selectedSet.has(`${tileX},${tileY}`)) {
            continue;
          }

          // Find existing tile
          const existingTile = await prisma.tile.findFirst({
            where: { mapId, z, x: tileX, y: tileY },
          });

          let finalTile: Buffer = genTile;

          // If tile exists and has URLs, blend with existing
          if (existingTile?.urls.length) {
            try {
              const existingResponse = await fetch(existingTile.urls[0]);
              if (existingResponse.ok) {
                const existsBuf = Buffer.from(await existingResponse.arrayBuffer());
                
                // Create tile-specific mask
                const tileMask = await sharp(mask3x3)
                  .extract({ 
                    left: (dx + 1) * TILE, 
                    top: (dy + 1) * TILE, 
                    width: TILE, 
                    height: TILE 
                  })
                  .png()
                  .toBuffer();

                // Blend generated tile over existing
                const maskedGen = await sharp(genTile)
                  .composite([{ input: tileMask, blend: 'dest-in' }])
                  .webp()
                  .toBuffer();

                finalTile = await sharp(existsBuf)
                  .resize(TILE, TILE, { fit: 'fill' })
                  .composite([{ input: maskedGen, blend: 'over' }])
                  .webp()
                  .toBuffer();
              }
            } catch (err) {
              console.warn(`Failed to blend tile ${tileX},${tileY}, using new tile:`, err);
            }
          }

          // Upload final tile to S3
          const tileKey = generateTileKey(mapId, z, tileX, tileY);
          const tileUrl = await uploadImageToS3({
            buffer: finalTile,
            key: tileKey,
            contentType: "image/webp",
          });

          // Update or create tile in database
          if (existingTile) {
            await prisma.tile.update({
              where: { id: existingTile.id },
              data: {
                urls: [tileUrl],
              },
            });
          } else {
            await prisma.tile.create({
              data: {
                mapId,
                z,
                x: tileX,
                y: tileY,
                urls: [tileUrl],
              },
            });
          }

          updatedTiles.push({ x: tileX, y: tileY, url: tileUrl });
        }
      }

      return {
        success: true,
        updatedTiles,
        message: `Updated ${updatedTiles.length} tiles successfully`,
      };
    }),
});

// Helper functions
async function extractTiles(compositeBuffer: Buffer): Promise<Buffer[][]> {
  const tiles: Buffer[][] = [];
  
  for (let y = 0; y < 3; y++) {
    const row: Buffer[] = [];
    for (let x = 0; x < 3; x++) {
      const tile = await sharp(compositeBuffer)
        .extract({
          left: x * TILE,
          top: y * TILE,
          width: TILE,
          height: TILE,
        })
        .webp()
        .toBuffer();
      row.push(tile);
    }
    tiles.push(row);
  }
  
  return tiles;
}

async function createCircularGradientMask(size: number): Promise<Buffer> {
  const center = size / 2;
  const radius = size / 2;
  const width = size, height = size, channels = 4;
  const buf = Buffer.alloc(width * height * channels);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - center, dy = y - center;
      const d = Math.sqrt(dx*dx + dy*dy);
      let a: number;
      if (d <= radius * 0.5) a = 255; 
      else if (d >= radius) a = 0; 
      else a = Math.round(255 * (1 - (d - radius*0.5)/(radius*0.5)));
      const i = (y*width + x) * channels;
      buf[i] = buf[i+1] = buf[i+2] = 255; 
      buf[i+3] = a;
    }
  }
  
  return sharp(buf, { raw: { width, height, channels: channels as 4 } }).png().toBuffer();
}
