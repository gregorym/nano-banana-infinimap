import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: `https://${
    process.env.DO_SPACES_REGION || "nyc3"
  }.digitaloceanspaces.com`,
  region: process.env.DO_SPACES_REGION || "nyc3",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
});

export interface UploadImageOptions {
  buffer: Buffer;
  key: string;
  contentType?: string;
  bucket?: string;
}

export async function uploadImageToS3({
  buffer,
  key,
  contentType = "image/webp",
  bucket = process.env.DO_SPACES_BUCKET!,
}: UploadImageOptions): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable", // Cache for 1 year
      ACL: "public-read", // Make the object publicly readable
    });

    await s3Client.send(command);

    // Return the public URL for DigitalOcean Spaces
    const region = process.env.DO_SPACES_REGION || "nyc3";
    const url = `https://${bucket}.${region}.digitaloceanspaces.com/${key}`;
    return url;
  } catch (error) {
    console.error("Failed to upload image to DigitalOcean Spaces:", error);
    throw new Error(
      `DigitalOcean Spaces upload failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function generateTileKey(
  mapId: string,
  z: number,
  x: number,
  y: number
): string {
  return `imaginemaps/${mapId}/tiles/${z}_${x}_${y}_${Date.now()}.webp`;
}

export function generatePreviewKey(
  mapId: string,
  z: number,
  x: number,
  y: number
): string {
  return `imaginemaps/${mapId}/previews/${z}_${x}_${y}_${Date.now()}.webp`;
}
