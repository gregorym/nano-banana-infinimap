import { blake2sHex } from "@/lib/hashing";
import { readTileFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATH =
  process.env.DEFAULT_TILE_PATH ?? "./public/default-tile.webp";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z: zStr, x: xStr, y: yStr } = await params;
  const z = Number(zStr),
    x = Number(xStr),
    y = Number(yStr);

  let body = await readTileFile(z, x, y);
  if (!body) {
    body = await fs.readFile(path.resolve(DEFAULT_PATH));
  }

  const etag = `"${blake2sHex(body).slice(0, 16)}"`;
  return new NextResponse(body as any, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}
