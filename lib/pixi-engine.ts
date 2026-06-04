import * as PIXI from "pixi.js";

export class Draggable {
  private app: PIXI.Application;
  private viewport: PIXI.Container;
  private isDragging = false;
  private lastPosition = { x: 0, y: 0 };
  private gridRenderer: GridRenderer | null = null;
  private tiles: any[] = [];
  private zoomTimeout: any = null;

  constructor(app: PIXI.Application, viewport: PIXI.Container) {
    this.app = app;
    this.viewport = viewport;
    this.setupDragEvents();
  }

  setGridRenderer(gridRenderer: GridRenderer) {
    this.gridRenderer = gridRenderer;
  }

  setTiles(tiles: any[]) {
    this.tiles = tiles || [];
  }

  private setupDragEvents() {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage
      .on("pointerdown", this.onDragStart.bind(this))
      .on("pointermove", this.onDragMove.bind(this))
      .on("pointerup", this.onDragEnd.bind(this))
      .on("pointerupoutside", this.onDragEnd.bind(this))
      .on("wheel", this.onWheel.bind(this));
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
      this.gridRenderer.checkForRegeneration(this.tiles);
    }
  }

  private onDragEnd() {
    this.isDragging = false;
  }

  private onWheel(event: PIXI.FederatedWheelEvent) {
    // Prevent default scrolling
    event.preventDefault();

    if (this.gridRenderer) {
      // Clear existing timeout
      if (this.zoomTimeout) {
        clearTimeout(this.zoomTimeout);
      }

      // Debounce zoom to avoid excessive recalculations
      this.zoomTimeout = setTimeout(() => {
        if (this.gridRenderer) {
          if (event.deltaY < 0) {
            // Scroll up - zoom in (increase cell size)
            this.gridRenderer.zoomIn(this.tiles);
          } else {
            // Scroll down - zoom out (decrease cell size)
            this.gridRenderer.zoomOut(this.tiles);
          }
        }
      }, 50); // 50ms debounce
    }
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
  private VISIBLE_GRID_WIDTH: number; // Tiles visible on screen
  private VISIBLE_GRID_HEIGHT: number; // Tiles visible on screen
  private BUFFER_SIZE = 10; // Extra tiles around visible area
  private TOTAL_GRID_WIDTH: number; // Total rendered tiles (visible + buffer)
  private TOTAL_GRID_HEIGHT: number; // Total rendered tiles (visible + buffer)
  private readonly WORLD_SIZE = 100000; // 100,000 total cells
  private CELL_SIZE = 128; // Dynamic cell size (min 56, max 128)
  private readonly MIN_CELL_SIZE = 12;
  private readonly MAX_CELL_SIZE = 128;

  get tilesCount() {
    return this.tiles.size;
  }

  get cellSize() {
    return this.CELL_SIZE;
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
    this.VISIBLE_GRID_HEIGHT = Math.ceil(
      this.app.screen.height / this.CELL_SIZE
    );

    // Create larger grid with buffer for smooth scrolling
    this.TOTAL_GRID_WIDTH = this.VISIBLE_GRID_WIDTH + this.BUFFER_SIZE * 2;
    this.TOTAL_GRID_HEIGHT = this.VISIBLE_GRID_HEIGHT + this.BUFFER_SIZE * 2;

    // console.log(`Calculated grid size: visible ${this.VISIBLE_GRID_WIDTH}x${this.VISIBLE_GRID_HEIGHT}, total ${this.TOTAL_GRID_WIDTH}x${this.TOTAL_GRID_HEIGHT} for screen ${this.app.screen.width}x${this.app.screen.height}`);
  }

  private drawFixedGrid(tiles?: any[]) {
    this.gridLines.clear();

    // If no tiles data, don't draw grid over everything
    if (!tiles || tiles.length === 0) {
      this.gridLines.stroke({ color: 0x333333, width: 2, alpha: 0.8 });

      // Draw full grid when no tiles exist
      for (let gridY = 0; gridY < this.TOTAL_GRID_HEIGHT; gridY++) {
        for (let gridX = 0; gridX < this.TOTAL_GRID_WIDTH; gridX++) {
          const x = gridX * this.CELL_SIZE;
          const y = gridY * this.CELL_SIZE;
          this.gridLines.rect(x, y, this.CELL_SIZE, this.CELL_SIZE);
        }
      }
      this.gridLines.stroke();
      return;
    }

    this.gridLines.stroke({ color: 0x333333, width: 2, alpha: 0.8 });

    // Use the same center calculation as loadVisibleTiles
    let centerX, centerY;
    if (
      tiles &&
      tiles.length > 0 &&
      this.currentOffsetX === 0 &&
      this.currentOffsetY === 0
    ) {
      // Calculate center of existing tiles on first load
      const minX = Math.min(...tiles.map((t) => t.x));
      const maxX = Math.max(...tiles.map((t) => t.x));
      const minY = Math.min(...tiles.map((t) => t.y));
      const maxY = Math.max(...tiles.map((t) => t.y));
      centerX = Math.floor((minX + maxX) / 2);
      centerY = Math.floor((minY + maxY) / 2);
    } else {
      centerX =
        Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetX;
      centerY =
        Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetY;
    }

    const startWorldX = centerX - Math.floor(this.TOTAL_GRID_WIDTH / 2);
    const startWorldY = centerY - Math.floor(this.TOTAL_GRID_HEIGHT / 2);

    // console.log(`Drawing grid with ${tiles.length} tiles, startWorld: (${startWorldX}, ${startWorldY})`);
    // console.log("Available tiles:", tiles.map((t) => `(${t.x},${t.y})`));

    // Draw grid only for cells without images
    for (let gridY = 0; gridY < this.TOTAL_GRID_HEIGHT; gridY++) {
      for (let gridX = 0; gridX < this.TOTAL_GRID_WIDTH; gridX++) {
        const worldX = startWorldX + gridX;
        const worldY = startWorldY + gridY;

        // Check if this world coordinate has an image tile
        const hasImage =
          tiles?.some(
            (t) =>
              t.x === worldX && t.y === worldY && t.urls && t.urls.length > 0
          ) || false;

        // Debug log for center area
        // if (Math.abs(gridX - Math.floor(this.TOTAL_GRID_WIDTH / 2)) < 2 && Math.abs(gridY - Math.floor(this.TOTAL_GRID_HEIGHT / 2)) < 2) {
        //   console.log(`Grid (${gridX},${gridY}) -> world (${worldX},${worldY}) -> hasImage: ${hasImage}`);
        // }

        // Only draw grid lines for cells without images
        if (!hasImage) {
          const x = gridX * this.CELL_SIZE;
          const y = gridY * this.CELL_SIZE;

          // Draw cell border
          this.gridLines.rect(x, y, this.CELL_SIZE, this.CELL_SIZE);
        }
      }
    }

    this.gridLines.stroke();
  }

  centerGrid(tiles?: any[]) {
    // Recalculate grid size for window resize
    this.calculateGridSize();

    // Redraw grid with new size and tile data
    this.drawFixedGrid(tiles);

    // Position the larger grid so visible area is centered on screen
    // The buffer area extends beyond the visible screen
    this.viewport.x = -this.BUFFER_SIZE * this.CELL_SIZE;
    this.viewport.y = -this.BUFFER_SIZE * this.CELL_SIZE;

    // Reload tiles with new grid size
    this.loadVisibleTiles(tiles);
  }

  getTileKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  loadTile(
    gridX: number,
    gridY: number,
    worldX: number,
    worldY: number,
    tiles?: any[]
  ): PIXI.Sprite {
    const key = this.getTileKey(worldX, worldY);

    if (this.tiles.has(key)) {
      return this.tiles.get(key)!;
    }

    // Check if we have a real tile for these coordinates
    const existingTile = tiles?.find((t) => t.x === worldX && t.y === worldY);

    if (existingTile && existingTile.urls && existingTile.urls.length > 0) {
      // Load real tile image (no border)
      const sprite = new PIXI.Sprite();
      sprite.position.set(gridX * this.CELL_SIZE, gridY * this.CELL_SIZE);
      sprite.width = this.CELL_SIZE;
      sprite.height = this.CELL_SIZE;

      // Load the image asynchronously
      PIXI.Assets.load(existingTile.urls[0])
        .then((texture) => {
          sprite.texture = texture;
        })
        .catch((error) => {
          console.error("Failed to load tile image:", error);
          // Fall back to placeholder (with border)
          this.createPlaceholderTile(sprite, worldX, worldY);
        });

      // Make tiles interactive for clicking
      sprite.eventMode = "static";
      sprite.cursor = "pointer";

      this.tiles.set(key, sprite);
      this.gridContainer.addChild(sprite);
      return sprite;
    }

    // Create placeholder tile - checkerboard pattern with world coordinates
    const sprite = new PIXI.Sprite();
    sprite.position.set(gridX * this.CELL_SIZE, gridY * this.CELL_SIZE);
    sprite.width = this.CELL_SIZE;
    sprite.height = this.CELL_SIZE;

    this.createPlaceholderTile(sprite, worldX, worldY);

    // Make tiles interactive for clicking
    sprite.eventMode = "static";
    sprite.cursor = "pointer";

    this.tiles.set(key, sprite);
    this.gridContainer.addChild(sprite);

    return sprite;
  }

  private createPlaceholderTile(
    sprite: PIXI.Sprite,
    worldX: number,
    worldY: number
  ) {
    const graphics = new PIXI.Graphics();

    // Simple checkerboard pattern
    const isEven = (worldX + worldY) % 2 === 0;
    const color = isEven ? 0x666666 : 0x999999;

    graphics.rect(0, 0, this.CELL_SIZE, this.CELL_SIZE);
    graphics.fill(color);
    graphics.stroke({ color: 0xcccccc, width: 1 });

    // Add world coordinates text
    const style = new PIXI.TextStyle({
      fontFamily: "Arial",
      fontSize: 10,
      fill: 0xffffff,
      align: "center",
    });

    const text = new PIXI.Text(`${worldX},${worldY}`, style);
    text.anchor.set(0.5);
    text.position.set(this.CELL_SIZE / 2, this.CELL_SIZE / 2);

    const container = new PIXI.Container();
    const bgSprite = new PIXI.Sprite(
      this.app.renderer.generateTexture(graphics)
    );
    container.addChild(bgSprite);
    container.addChild(text);

    const texture = this.app.renderer.generateTexture(container);
    graphics.destroy();
    container.destroy();

    sprite.texture = texture;
  }

  private currentOffsetX = 0; // World coordinate offset
  private currentOffsetY = 0; // World coordinate offset

  // Load the larger pre-rendered grid
  loadVisibleTiles(tiles?: any[]) {
    // Clear existing tiles
    this.tiles.forEach((sprite) => {
      this.gridContainer.removeChild(sprite);
      sprite.destroy();
    });
    this.tiles.clear();

    // Find center based on existing tiles, or use world center as fallback
    let centerX, centerY;

    if (
      tiles &&
      tiles.length > 0 &&
      this.currentOffsetX === 0 &&
      this.currentOffsetY === 0
    ) {
      // Calculate center of existing tiles on first load
      const minX = Math.min(...tiles.map((t) => t.x));
      const maxX = Math.max(...tiles.map((t) => t.x));
      const minY = Math.min(...tiles.map((t) => t.y));
      const maxY = Math.max(...tiles.map((t) => t.y));

      centerX = Math.floor((minX + maxX) / 2);
      centerY = Math.floor((minY + maxY) / 2);

      // console.log(`Centering on existing tiles: (${centerX}, ${centerY}) from bounds (${minX}-${maxX}, ${minY}-${maxY})`);
    } else {
      // Use current position or world center
      centerX =
        Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetX;
      centerY =
        Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetY;
    }

    // Calculate starting world coordinates for the larger grid (includes buffer)
    const startWorldX = centerX - Math.floor(this.TOTAL_GRID_WIDTH / 2);
    const startWorldY = centerY - Math.floor(this.TOTAL_GRID_HEIGHT / 2);

    // console.log(`Loading ${this.TOTAL_GRID_WIDTH}x${this.TOTAL_GRID_HEIGHT} grid starting at world coordinates (${startWorldX}, ${startWorldY})`);

    // Load tiles to fill the larger grid (visible + buffer)
    for (let gridY = 0; gridY < this.TOTAL_GRID_HEIGHT; gridY++) {
      for (let gridX = 0; gridX < this.TOTAL_GRID_WIDTH; gridX++) {
        const worldX = startWorldX + gridX;
        const worldY = startWorldY + gridY;

        // Only load if within world bounds
        if (
          worldX >= 0 &&
          worldY >= 0 &&
          worldX < Math.sqrt(this.WORLD_SIZE) &&
          worldY < Math.sqrt(this.WORLD_SIZE)
        ) {
          this.loadTile(gridX, gridY, worldX, worldY, tiles);
        }
      }
    }

    // console.log(`Loaded ${this.tiles.size} tiles`);

    // Redraw grid lines to hide lines over image tiles
    this.drawFixedGrid(tiles);
  }

  // Check if we've moved far enough to need new tiles
  checkForRegeneration(tiles?: any[]) {
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
      this.loadVisibleTiles(tiles);
    }
  }

  clearTiles() {
    this.tiles.forEach((sprite) => {
      this.gridContainer.removeChild(sprite);
      sprite.destroy();
    });
    this.tiles.clear();
  }

  // Get tile coordinates from screen position
  getTileAt(
    screenX: number,
    screenY: number,
    tiles?: any[]
  ): { gridX: number; gridY: number; worldX: number; worldY: number } | null {
    // Convert screen to grid coordinates
    const localX = screenX - this.viewport.x;
    const localY = screenY - this.viewport.y;

    const gridX = Math.floor(localX / this.CELL_SIZE);
    const gridY = Math.floor(localY / this.CELL_SIZE);

    // Check if within total grid bounds
    if (
      gridX < 0 ||
      gridX >= this.TOTAL_GRID_WIDTH ||
      gridY < 0 ||
      gridY >= this.TOTAL_GRID_HEIGHT
    ) {
      return null;
    }

    // Use the same center calculation as loadVisibleTiles and drawFixedGrid
    let centerX, centerY;
    if (
      tiles &&
      tiles.length > 0 &&
      this.currentOffsetX === 0 &&
      this.currentOffsetY === 0
    ) {
      // Calculate center of existing tiles on first load
      const minX = Math.min(...tiles.map((t) => t.x));
      const maxX = Math.max(...tiles.map((t) => t.x));
      const minY = Math.min(...tiles.map((t) => t.y));
      const maxY = Math.max(...tiles.map((t) => t.y));
      centerX = Math.floor((minX + maxX) / 2);
      centerY = Math.floor((minY + maxY) / 2);
    } else {
      centerX =
        Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetX;
      centerY =
        Math.floor(Math.sqrt(this.WORLD_SIZE) / 2) + this.currentOffsetY;
    }

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

  // Zoom in (increase cell size)
  zoomIn(tiles?: any[]) {
    const newSize = Math.min(this.CELL_SIZE + 16, this.MAX_CELL_SIZE);
    if (newSize !== this.CELL_SIZE) {
      this.CELL_SIZE = newSize;
      this.recalculateAndRedraw(tiles);
    }
  }

  // Zoom out (decrease cell size)
  zoomOut(tiles?: any[]) {
    const newSize = Math.max(this.CELL_SIZE - 16, this.MIN_CELL_SIZE);
    if (newSize !== this.CELL_SIZE) {
      this.CELL_SIZE = newSize;
      this.recalculateAndRedraw(tiles);
    }
  }

  // Helper method to recalculate grid and redraw everything
  private recalculateAndRedraw(tiles?: any[]) {
    // Recalculate grid size with new cell size
    this.calculateGridSize();

    // Redraw grid lines
    this.drawFixedGrid(tiles);

    // Recenter viewport
    this.viewport.x = -this.BUFFER_SIZE * this.CELL_SIZE;
    this.viewport.y = -this.BUFFER_SIZE * this.CELL_SIZE;

    // Reload all tiles with new size
    this.loadVisibleTiles(tiles);
  }
}

export class TileManager {
  private tileExists: Map<string, boolean> = new Map();
  private pendingChecks: Map<string, Promise<boolean>> = new Map();

  getTileKey(x: number, y: number, z: number): string {
    return `${z}:${x}:${y}`;
  }

  async checkTileExists(
    x: number,
    y: number,
    z: number,
    mapDepth: number
  ): Promise<boolean> {
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

  private async performTileCheck(
    x: number,
    y: number,
    z: number,
    mapDepth: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/meta/${mapDepth}/${x}/${y}`);
      const data = await response.json();
      return data.status === "READY";
    } catch (error) {
      console.error("Failed to check tile existence:", error);
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
