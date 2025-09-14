// Coordinate system utilities for converting between Leaflet Simple CRS and deck.gl CARTESIAN coordinates

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface WorldCoordinate {
  x: number;
  y: number;
}

export interface ViewState {
  target: [number, number, number];
  zoom: number;
}

/**
 * Convert tile coordinates to world coordinates
 * In Simple CRS, each tile is 256px and world coordinates are pixel-based
 */
export function tileToWorld(tileX: number, tileY: number, tileSize: number = 256): WorldCoordinate {
  return {
    x: (tileX + 0.5) * tileSize,
    y: (tileY + 0.5) * tileSize,
  };
}

/**
 * Convert world coordinates to tile coordinates
 */
export function worldToTile(worldX: number, worldY: number, tileSize: number = 256): TileCoordinate {
  return {
    x: Math.floor(worldX / tileSize),
    y: Math.floor(worldY / tileSize),
    z: 0, // Will be set based on zoom level
  };
}

/**
 * Get the bounds for a tile in world coordinates
 */
export function getTileBounds(tileX: number, tileY: number, tileSize: number = 256): [number, number, number, number] {
  const left = tileX * tileSize;
  const top = tileY * tileSize;
  const right = (tileX + 1) * tileSize;
  const bottom = (tileY + 1) * tileSize;

  return [left, top, right, bottom];
}

/**
 * Convert from Leaflet Simple CRS lat/lng to deck.gl world coordinates
 * Leaflet Simple CRS: lat/lng are actually y/x coordinates in the world space
 */
export function leafletLatLngToWorld(lat: number, lng: number, depth: number): WorldCoordinate {
  // In Leaflet Simple CRS with our setup:
  // - lng represents x coordinate
  // - lat represents y coordinate (flipped from normal lat/lng)
  // - coordinates are already in world pixel space
  return {
    x: lng,
    y: lat,
  };
}

/**
 * Convert deck.gl world coordinates to Leaflet Simple CRS lat/lng
 */
export function worldToLeafletLatLng(worldX: number, worldY: number, depth: number): { lat: number; lng: number } {
  return {
    lat: worldY,
    lng: worldX,
  };
}

/**
 * Calculate the world size based on depth
 */
export function getWorldSize(depth: number, tileSize: number = 256): number {
  return (1 << depth) * tileSize;
}

/**
 * Convert zoom level and center coordinates to deck.gl view state
 */
export function createViewState(
  centerX: number,
  centerY: number,
  zoom: number,
  depth: number
): ViewState {
  // For deck.gl OrthographicView with tiles:
  // We want zoom level to correspond directly to tile zoom levels
  // Higher zoom means more zoomed in (closer to tiles)

  // Map zoom levels to deck.gl zoom
  // At map zoom 0, we see the whole world, so deck.gl zoom should be low
  // At map zoom = depth, we see individual tiles, so deck.gl zoom should be high
  const deckglZoom = zoom;

  return {
    target: [centerX, centerY, 0],
    zoom: deckglZoom,
  };
}

/**
 * Extract tile coordinates from deck.gl picking info
 */
export function getPickedTileCoordinates(
  x: number,
  y: number,
  zoom: number,
  tileSize: number = 256
): TileCoordinate {
  return {
    x: Math.floor(x / tileSize),
    y: Math.floor(y / tileSize),
    z: zoom,
  };
}