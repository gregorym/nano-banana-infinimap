"use client";

import { api } from "@/trpc/react";
import dynamic from "next/dynamic";
import {
  useRouter,
  useSearchParams as useSearchParamsHook,
} from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as PIXI from 'pixi.js';
import { Draggable, GridRenderer, TileManager } from "@/lib/pixi-engine";
import { TILE, ZMAX } from "@/lib/coords";

const TileControls = dynamic(() => import("./TileControls"), { ssr: false });

type PixiMapClientProps = {
  mapId: string;
};

export default function PixiMapClient({ mapId }: PixiMapClientProps) {
  const { data: mapConfig } = api.maps.get.useQuery({ id: mapId });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const viewportRef = useRef<PIXI.Container | null>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const tileManagerRef = useRef<TileManager | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<{
    gridX: number;
    gridY: number;
    worldX: number;
    worldY: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [selectedTile, setSelectedTile] = useState<{
    gridX: number;
    gridY: number;
    worldX: number;
    worldY: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParamsHook();
  const updateTimeoutRef = useRef<any>(undefined);
  const mouseMoveTimeoutRef = useRef<any>(undefined);

  // URL update function - moved inside useEffect to avoid dependency issues

  // Handle tile generation
  const handleGenerate = useCallback(
    async (x: number, y: number, prompt: string) => {
      try {
        const response = await fetch(
          `/api/claim/${mapConfig?.depth}/${x}/${y}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          }
        );

        if (response.ok) {
          // Start polling for completion
          if (gridRendererRef.current) {
            pollTileStatus(x, y, mapConfig?.depth || ZMAX);
          }
        }
      } catch (error) {
        console.error("Failed to generate tile:", error);
        throw error;
      }
    },
    [mapConfig?.depth]
  );

  // Handle tile regeneration
  const handleRegenerate = useCallback(
    async (x: number, y: number, prompt: string) => {
      try {
        const response = await fetch(
          `/api/invalidate/${mapConfig?.depth}/${x}/${y}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          }
        );

        if (response.ok) {
          // Start polling for completion
          if (gridRendererRef.current) {
            pollTileStatus(x, y, mapConfig?.depth || ZMAX);
          }
        }
      } catch (error) {
        console.error("Failed to regenerate tile:", error);
        throw error;
      }
    },
    [mapConfig?.depth]
  );

  // Handle tile deletion
  const handleDelete = useCallback(
    async (x: number, y: number) => {
      try {
        const response = await fetch(
          `/api/delete/${mapConfig?.depth}/${x}/${y}`,
          {
            method: "DELETE",
          }
        );

        if (response.ok) {
          // Refresh the tile
          if (gridRendererRef.current) {
            gridRendererRef.current.refreshTile(x, y, mapConfig?.depth || ZMAX);
          }
        }
      } catch (error) {
        console.error("Failed to delete tile:", error);
        throw error;
      }
    },
    [mapConfig?.depth]
  );

  // Poll for tile generation completion
  const pollTileStatus = async (x: number, y: number, z: number) => {
    let attempts = 0;
    const maxAttempts = 30;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/meta/${z}/${x}/${y}`);
        const data = await response.json();

        if (data.status === "READY") {
          console.log(`Tile ready at ${z}/${x}/${y}, refreshing...`);
          if (gridRendererRef.current) {
            gridRendererRef.current.refreshTile(x, y, z);
          }
        } else if (data.status === "PENDING" && attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 1000);
        }
      } catch (error) {
        console.error("Error checking tile status:", error);
      }
    };

    setTimeout(checkStatus, 1000);
  };

  // Convert screen coordinates to tile coordinates - defined inside useEffect to avoid dependencies
  // Convert tile coordinates to screen coordinates - defined inside useEffect to avoid dependencies

  // Initialize Pixi application
  useEffect(() => {
    if (!canvasRef.current || initialized || !mapConfig) return;

    const initPixi = async () => {
      try {
        console.log('Initializing Pixi fixed grid...');

        // Create Pixi application
        const app = new PIXI.Application();
        await app.init({
          canvas: canvasRef.current!,
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x222222,
          antialias: true,
        });

        // Create viewport container
        const viewport = new PIXI.Container();
        app.stage.addChild(viewport);

        // Initialize engine components (no zoom anymore)
        const draggable = new Draggable(app, viewport);
        const gridRenderer = new GridRenderer(app, viewport);
        const tileManager = new TileManager();

        // Connect draggable to grid renderer for navigation
        draggable.setGridRenderer(gridRenderer);

        // Store references
        appRef.current = app;
        viewportRef.current = viewport;
        draggableRef.current = draggable;
        gridRendererRef.current = gridRenderer;
        tileManagerRef.current = tileManager;

        // Load initial 10x15 grid (centered on world)
        console.log('Loading initial 10x15 grid...');
        gridRenderer.loadVisibleTiles();

        // Setup simple mouse events for tile interaction
        app.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
          if (mouseMoveTimeoutRef.current) {
            clearTimeout(mouseMoveTimeoutRef.current);
          }

          mouseMoveTimeoutRef.current = setTimeout(() => {
            const tileInfo = gridRenderer.getTileAt(event.global.x, event.global.y);
            if (tileInfo) {
              setHoveredTile({
                ...tileInfo,
                screenX: event.global.x,
                screenY: event.global.y,
              });
            } else {
              setHoveredTile(null);
            }
          }, 50);
        });

        app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
          const tileInfo = gridRenderer.getTileAt(event.global.x, event.global.y);
          if (tileInfo) {
            setSelectedTile({
              ...tileInfo,
              screenX: event.global.x,
              screenY: event.global.y,
            });
          }
        });

        setInitialized(true);
        console.log('Pixi fixed grid initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Pixi map:', error);
      }
    };

    initPixi();

    // Handle window resize
    const handleResize = () => {
      if (appRef.current && gridRendererRef.current) {
        appRef.current.renderer.resize(window.innerWidth, window.innerHeight);
        gridRendererRef.current.centerGrid();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (appRef.current) {
        appRef.current.destroy();
        appRef.current = null;
      }
      setInitialized(false);
    };
  }, [mapConfig, mapId]);

  return (
    <div className="w-full h-full relative">
      <div className="p-3 z-10 absolute top-2 left-2 bg-white/90 rounded-xl shadow-lg flex flex-col gap-2">
        <div className="text-sm text-gray-600">
          Dynamic Grid - Navigate by dragging
        </div>
        <div className="text-xs text-gray-400">
          Initialized: {initialized ? 'Yes' : 'No'}
        </div>
        {gridRendererRef.current && (
          <div className="text-xs text-gray-400">
            Tiles loaded: {gridRendererRef.current.tilesCount}
          </div>
        )}
        {hoveredTile && (
          <div className="text-xs text-gray-400">
            Hovered: World({hoveredTile.worldX}, {hoveredTile.worldY})
          </div>
        )}
      </div>

      {/* Hover highlight */}
      {hoveredTile && !selectedTile && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: hoveredTile.screenX - 32,
            top: hoveredTile.screenY - 32,
            width: 64,
            height: 64,
            background: "rgba(255,255,255,0.3)",
            border: "2px solid rgba(255,255,255,0.8)",
            zIndex: 1000,
          }}
        />
      )}

      {/* Tile menu */}
      {selectedTile && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: selectedTile.screenX,
            top: selectedTile.screenY,
            transform: "translate(-50%, -50%)",
            zIndex: 1500,
          }}
        >
          <div
            className="pointer-events-auto bg-white rounded-lg shadow-xl p-2 border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-500 mb-1">
              World Tile ({selectedTile.worldX}, {selectedTile.worldY})
            </div>
            <TileControls
              x={selectedTile.worldX}
              y={selectedTile.worldY}
              z={mapConfig?.depth}
              exists={false} // Simplified for now
              onGenerate={(prompt) =>
                handleGenerate(selectedTile.worldX, selectedTile.worldY, prompt)
              }
              onRegenerate={(prompt) =>
                handleRegenerate(selectedTile.worldX, selectedTile.worldY, prompt)
              }
              onDelete={() => handleDelete(selectedTile.worldX, selectedTile.worldY)}
            />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}