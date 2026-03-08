// apps/web/hooks/useSupabase.ts
import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createSupabaseBrowserClient } from "@workspace/db";

export function useSupabase() {
  const { session } = useSession();
  return useMemo(
    () =>
      createSupabaseBrowserClient(
        { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        async () => session?.getToken() ?? null
      ),
    // session identity is stable per sign-in; re-create only if session changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id]
  );
}
