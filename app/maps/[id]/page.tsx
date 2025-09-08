"use client";

import { api } from "@/trpc/react";
import { notFound } from "next/navigation";
import { Suspense, lazy, use } from "react";

interface MapPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function MapPage({ params }: MapPageProps) {
  const { id } = use(params);
  
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center">
          Loading map...
        </div>
      }
    >
      <MapContent mapId={id} />
    </Suspense>
  );
}

function MapContent({ mapId }: { mapId: string }) {
  const { data: _map, isLoading, error } = api.maps.get.useQuery({ id: mapId });

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return notFound();
  }

  return (
    <main className="w-screen h-screen">
      <Suspense fallback={<div>Loading map client...</div>}>
        <MapClient mapId={mapId} />
      </Suspense>
    </main>
  );
}

function MapClient({ mapId }: { mapId: string }) {
  const MapClientComponent = lazy(() => import("@/components/MapClient"));
  return <MapClientComponent mapId={mapId} />;
}
