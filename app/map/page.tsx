import { Suspense } from "react";

export default function Page() {
  return (
    <main className="w-screen h-screen">
      <Suspense fallback={<div>Loading map...</div>}>
        <ClientBoundary />
      </Suspense>
    </main>
  );
}

async function ClientBoundary() {
  const PixiMapClient = (await import("@/components/PixiMapClient")).default;
  // Use a default map ID for the legacy /map route
  return <PixiMapClient mapId="default" />;
}