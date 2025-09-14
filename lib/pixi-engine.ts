import * as PIXI from 'pixi.js';
import { TILE, ZMAX } from './coords';

export class Draggable {
  private app: PIXI.Application;
  private viewport: PIXI.Container;
  private isDragging = false;
  private lastPosition = { x: 0, y: 0 };
  private gridRenderer: GridRenderer | null = null;

  constructor(app: PIXI.Application, viewport: PIXI.Container) {
    this.app = app;
    this.viewport = viewport;
    this.setupDragEvents();
  }

  setGridRenderer(gridRenderer: GridRenderer) {
    this.gridRenderer = gridRenderer;
  }

  private setupDragEvents() {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.app.stage
      .on('pointerdown', this.onDragStart.bind(this))
      .on('pointermove', this.onDragMove.bind(this))
      .on('pointerup', this.onDragEnd.bind(this))
      .on('pointerupoutside', this.onDragEnd.bind(this));
  }

  private onDragStart(event: PIXI.FederatedPointerEvent) {
    this.isDragging = true;
    this.lastPosition.x = event.global.x;
    this.lastPosition.y = event.global.y;
  }

  private onDragMove(event: PIXI.FederatedPointerEvent) {
    if (!this.isDragging) return;

    const deltaX = event.global.x - this.lastPosition.x;
    const deltaY = event.global.y - this.lastPosition.y;

    // Translate the viewport smoothly
    this.viewport.x += deltaX;
    this.viewport.y += deltaY;

    this.lastPosition.x = event.global.x;
    this.lastPosition.y = event.global.y;

    // Check if we need to regenerate grid when moving too far from center
    if (this.gridRenderer) {
      this.gridRenderer.checkForRegeneration();
    }
  }

  private onDragEnd() {
    this.isDragging = false;
  }
}

// Removed Zoomable class - no more zooming

export class GridRenderer {
  private app: PIXI.Application;
  private viewport: PIXI.Container;
  private gridContainer: PIXI.Container;
  private gridLines: PIXI.Graphics;
  private tiles: Map<string, PIXI.Sprite> = new Map();

  // Dynamic grid constants
  private VISIBLE_GRID_WIDTH: number;  // Tiles visible on screen
  private VISIBLE_GRID_HEIGHT: number; // Tiles visible on screen
  private BUFFER_SIZE = 10; // Extra tiles around visible area
  private TOTAL_GRID_WIDTH: number;    // Total rendered tiles (visible + buffer)
  private TOTAL_GRID_HEIGHT: number;   // Total rendered tiles (visible + buffer)
  private readonly WORLD_SIZE = 100000; // 100,000 total cells
  private readonly CELL_SIZE = 64; // Fixed cell size

  get tilesCount() {
    return this.tiles.size;
  }

  constructor(app: PIXI.Application, viewport: PIXI.Container) {
    this.app = app;
    this.viewport = viewport;
    this.gridContainer = new PIXI.Container();
    this.gridLines = new PIXI.Graphics();

    // Calculate grid size based on screen dimensions
    this.calculateGridSize();

    // Add both grid lines and container to viewport
    this.viewport.addChild(this.gridContainer);
    this.viewport.addChild(this.gridLines);

    // Draw grid lines for visible area
    this.drawFixedGrid();

    // Center the grid at startup
    this.centerGrid();
  }

  private calculateGridSize() {
    // Calculate how many tiles fit on screen
    this.VISIBLE_GRID_WIDTH = Math.ceil(this.app.screen.width / this.CELL_SIZE);
    this.VISIBLE_GRID_HEIGHT = Math.ceil(this.app.screen.height / this.CELL_SIZE);

    // Create larger grid with buffer for smooth scrolling
    this.TOTAL_GRID_WIDTH = this.VISIBLE_GRID_WIDTH + (this.BUFFER_SIZE * 2);
    this.TOTAL_GRID_HEIGHT = this.VISIBLE_GRID_HEIGHT + (this.BUFFER_SIZE * 2);

    console.log(`Calculated grid size: visible ${this.VISIBLE_GRID_WIDTH}x${this.VISIBLE_GRID_HEIGHT}, total ${this.TOTAL_GRID_WIDTH}x${this.TOTAL_GRID_HEIGHT} for screen ${this.app.screen.width}x${this.app.screen.height}`);
  }

  private drawFixedGrid() {
    this.gridLines.clear();
    this.gridLines.stroke({ color: 0x333333, width: 2, alpha: 0.8 });

    const gridWidth = this.TOTAL_GRID_WIDTH * this.CELL_SIZE;
    const gridHeight = this.TOTAL_GRID_HEIGHT * this.CELL_SIZE;

    // Draw vertical lines
    for (let i = 0; i <= this.TOTAL_GRID_WIDTH; i++) {
      const x = i * this.CELL_SIZE;
      this.gridLines.moveTo(x, 0);
      this.gridLines.lineTo(x, gridHeight);
    }

    // Draw horizontal lines
    for (let i = 0; i <= this.TOTAL_GRID_HEIGHT; i++) {
      const y = i * this.CELL_SIZE;
      this.gridLines.moveTo(0, y);
      this.gridLines.lineTo(gridWidth, y);
    }

    this.gridLines.stroke();
  }

  centerGrid() {
    // Recalculate grid size for window resize
    this.calculateGridSize();

    // Redraw grid with new size
    this.drawFixedGrid();

    // Position the larger grid so visible area is centered on screen
    // The buffer area extends beyond the visible screen
    this.viewport.x = -this.BUFFER_SIZE * this.CELL_SIZE;
    this.viewport.y = -this.BUFFER_SIZE * this.CELL_SIZE;

    // Reload tiles with new grid size
    this.loadVisibleTiles();
  }

  getTileKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  loadTile(gridX: number, gridY: number, worldX: number, worldY: number): PIXI.Sprite {
    const key = this.getTileKey(worldX, worldY);

    if (this.tiles.has(key)) {
      return this.tiles.get(key)!;
    }

    // Create simple tile - checkerboard pattern with world coordinates
    const graphics = new PIXI.Graphics();

    // Simple checkerboard pattern
    const isEven = (worldX + worldY) % 2 === 0;
    const color = isEven ? 0x666666 : 0x999999;

    graphics.rect(0, 0, this.CELL_SIZE, this.CELL_SIZE);
    graphics.fill(color);
    graphics.stroke({ color: 0xcccccc, width: 1 });

    // Add world coordinates text
    const style = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: 10,
      fill: 0xffffff,
      align: 'center',
    });

    const text = new PIXI.Text(`${worldX},${worldY}`, style);
    text.anchor.set(0.5);
    text.position.set(this.CELL_SIZE / 2, this.CELL_SIZE / 2);

    const container = new PIXI.Container();
    const bgSprite = new PIXI.Sprite(this.app.renderer.generateTexture(graphics));
    container.addChild(bgSprite);
    container.addChild(text);

    const texture = this.app.renderer.generateTexture(container);
    graphics.destroy();
    container.destroy();

    const sprite = new PIXI.Sprite(texture);
    sprite.position.set(gridX * this.CELL_SIZE, gridY * this.CELL_SIZE);
    sprite.width = this.CELL_SIZE;
    sprite.height = this.CELL_SIZE;

    // Make tiles interactive for clicking
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    this.tiles.set(key, sprite);
    this.gridContainer.addChild(sprite);

    return sprite;
  }

  private currentOffsetX = 0; // World coordinate offset
  private currentOffsetY = 0; // World coordinate offset

  // Load the larger pre-rendered grid
  loadVisibleTiles() {
    // Clear existing tiles
    this.tiles.forEach(sprite => {
      this.gridContainer.removeChild(sprite);
      sprite.destroy();
    });
    this.tiles.clear();

    // Start from center of 100,000 cell world (approximately 50,000, 50,000)
    const centerX = Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetX;
    const centerY = Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetY;

    // Calculate starting world coordinates for the larger grid (includes buffer)
    const startWorldX = centerX - Math.floor(this.TOTAL_GRID_WIDTH / 2);
    const startWorldY = centerY - Math.floor(this.TOTAL_GRID_HEIGHT / 2);

    console.log(`Loading ${this.TOTAL_GRID_WIDTH}x${this.TOTAL_GRID_HEIGHT} grid starting at world coordinates (${startWorldX}, ${startWorldY})`);

    // Load tiles to fill the larger grid (visible + buffer)
    for (let gridY = 0; gridY < this.TOTAL_GRID_HEIGHT; gridY++) {
      for (let gridX = 0; gridX < this.TOTAL_GRID_WIDTH; gridX++) {
        const worldX = startWorldX + gridX;
        const worldY = startWorldY + gridY;

        // Only load if within world bounds
        if (worldX >= 0 && worldY >= 0 && worldX < Math.sqrt(this.WORLD_SIZE) && worldY < Math.sqrt(this.WORLD_SIZE)) {
          this.loadTile(gridX, gridY, worldX, worldY);
        }
      }
    }

    console.log(`Loaded ${this.tiles.size} tiles`);
  }

  // Check if we've moved far enough to need new tiles
  checkForRegeneration() {
    // Calculate how far the viewport has moved from its initial centered position
    const initialX = -this.BUFFER_SIZE * this.CELL_SIZE;
    const initialY = -this.BUFFER_SIZE * this.CELL_SIZE;

    const deltaX = this.viewport.x - initialX;
    const deltaY = this.viewport.y - initialY;

    // If we've moved more than half the buffer, regenerate grid
    const threshold = (this.BUFFER_SIZE / 2) * this.CELL_SIZE;

    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
      // Update world offset based on viewport movement
      this.currentOffsetX -= Math.round(deltaX / this.CELL_SIZE);
      this.currentOffsetY -= Math.round(deltaY / this.CELL_SIZE);

      // Reset viewport position and regenerate grid
      this.viewport.x = initialX;
      this.viewport.y = initialY;
      this.loadVisibleTiles();
    }
  }

  clearTiles() {
    this.tiles.forEach(sprite => {
      this.gridContainer.removeChild(sprite);
      sprite.destroy();
    });
    this.tiles.clear();
  }

  // Get tile coordinates from screen position
  getTileAt(screenX: number, screenY: number): { gridX: number, gridY: number, worldX: number, worldY: number } | null {
    // Convert screen to grid coordinates
    const localX = screenX - this.viewport.x;
    const localY = screenY - this.viewport.y;

    const gridX = Math.floor(localX / this.CELL_SIZE);
    const gridY = Math.floor(localY / this.CELL_SIZE);

    // Check if within total grid bounds
    if (gridX < 0 || gridX >= this.TOTAL_GRID_WIDTH || gridY < 0 || gridY >= this.TOTAL_GRID_HEIGHT) {
      return null;
    }

    // Calculate world coordinates
    const centerX = Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetX;
    const centerY = Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetY;
    const startWorldX = centerX - Math.floor(this.TOTAL_GRID_WIDTH / 2);
    const startWorldY = centerY - Math.floor(this.TOTAL_GRID_HEIGHT / 2);

    const worldX = startWorldX + gridX;
    const worldY = startWorldY + gridY;

    return { gridX, gridY, worldX, worldY };
  }

  // Refresh a specific tile (for API compatibility)
  refreshTile(x: number, y: number, z: number) {
    // For the fixed grid, we just reload all visible tiles
    // This ensures the tile with updated content is properly displayed
    this.loadVisibleTiles();
  }
}

export class TileManager {
  private tileExists: Map<string, boolean> = new Map();
  private pendingChecks: Map<string, Promise<boolean>> = new Map();

  getTileKey(x: number, y: number, z: number): string {
    return `${z}:${x}:${y}`;
  }

  async checkTileExists(x: number, y: number, z: number, mapDepth: number): Promise<boolean> {
    const key = this.getTileKey(x, y, z);

    // Return cached result
    if (this.tileExists.has(key)) {
      return this.tileExists.get(key)!;
    }

    // Return existing promise if already checking
    if (this.pendingChecks.has(key)) {
      return this.pendingChecks.get(key)!;
    }

    // Create new check
    const promise = this.performTileCheck(x, y, z, mapDepth);
    this.pendingChecks.set(key, promise);

    try {
      const exists = await promise;
      this.tileExists.set(key, exists);
      return exists;
    } finally {
      this.pendingChecks.delete(key);
    }
  }

  private async performTileCheck(x: number, y: number, z: number, mapDepth: number): Promise<boolean> {
    try {
      const response = await fetch(`/api/meta/${mapDepth}/${x}/${y}`);
      const data = await response.json();
      return data.status === 'READY';
    } catch (error) {
      console.error('Failed to check tile existence:', error);
      return false;
    }
  }

  setTileExists(x: number, y: number, z: number, exists: boolean) {
    const key = this.getTileKey(x, y, z);
    this.tileExists.set(key, exists);
  }

  clearCache() {
    this.tileExists.clear();
    this.pendingChecks.clear();
  }
}