"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  );
};

function Lobby() {
  const router = useRouter();
  const { username } = useUsername();
  const searchParams = useSearchParams();

  const wasDestroyed = searchParams.get("destroyed") === "true";
  const error = searchParams.get("error");

  const { mutate: createRoom, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post();

      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`);
      }
    },
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-5">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">
            {">"}secure_chat
          </h1>
          <span className="text-sm text-zinc-500">
            Self-Destructing End-to-End Encrypted Chat App
          </span>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center text-zinc-500">
                Your Identity
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-400 font-mono">
                  {username}
                </div>
              </div>
            </div>
            <button
              onClick={() => createRoom()}
              disabled={isCreating}
              className="w-full bg-zinc-100 text-black p-3 text-sm font-bold hover:bg-zinc-50 hover:text-black transition-colors mt-2 cursor-pointer disabled:opacity-50"
            >
              {isCreating ? "CREATING..." : "CREATE SECURE ROOM"}
            </button>
          </div>
        </div>

        {wasDestroyed && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs p-4 text-center rounded-md">
            <p className="text-red-500 text-sm font-bold">ROOM DESTROYED</p>
            <p className="text-zinc-500 text-sm mt-1">
              All messages were permanently deleted.
            </p>
          </div>
        )}

        {error === "room-not-found" && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs p-4 text-center rounded-md">
            <p className="text-red-500 text-sm font-bold">ROOM NOT FOUND</p>
            <p className="text-zinc-500 text-sm mt-1">
              This room may have expired or never existed.
            </p>
          </div>
        )}

        {error === "room-full" && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs p-4 text-center rounded-md">
            <p className="text-red-500 text-sm font-bold">ROOM FULL</p>
            <p className="text-zinc-500 text-sm mt-1">
              This room is at maximum capacity.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default Page;
