export function generateTileKey(
  mapId: string,
  z: number,
  x: number,
  y: number
): string {
  return `imaginemaps/maps/${mapId}/tiles/${z}_${x}_${y}.webp`;
}

export function generatePreviewKey(
  mapId: string,
  z: number,
  x: number,
  y: number
): string {
  return `imaginemaps/maps/${mapId}/previews/${z}_${x}_${y}_${Date.now()}.webp`;
}
