"use client";

import { signInWithGoogle } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { data: me } = api.user.me.useQuery();
  const { data: maps, refetch: refetchMaps } = api.maps.all.useQuery(
    undefined,
    { enabled: !!me }
  );
  const createMap = api.maps.create.useMutation({
    onSuccess: (newMap) => {
      refetchMaps();
      router.push(`/maps/${newMap.id}`);
    },
  });

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleCreateMap = async () => {
    createMap.mutate({});
  };

  const handleOpenMap = (mapId: string) => {
    router.push(`/maps/${mapId}`);
  };

  if (me) {
    // Authenticated user view
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {me.name || me.email}!
            </h1>
            <p className="text-gray-600 mt-2">
              Create new maps or continue working on existing ones
            </p>
          </div>

          <div className="mb-8">
            <button
              onClick={handleCreateMap}
              disabled={createMap.isPending}
              className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMap.isPending ? "Creating..." : "Create New Map"}
            </button>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Maps
            </h2>
            {maps && maps.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {maps.map((map) => (
                  <div
                    key={map.id}
                    className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border"
                    onClick={() => handleOpenMap(map.id)}
                  >
                    <h3 className="font-medium text-gray-900 mb-2">
                      Map {map.id.slice(0, 8)}...
                    </h3>
                    <p className="text-sm text-gray-600">
                      Click to open and explore
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No maps yet. Create your first map to get started!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated user view
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to Infinimap
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to start creating your generative maps
          </p>
        </div>
        <div>
          <button
            onClick={handleGoogleSignIn}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
