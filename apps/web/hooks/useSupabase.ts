// apps/web/hooks/useSupabase.ts
import { useSession } from "@clerk/nextjs";
import { createSupabaseBrowserClient } from "@workspace/db";

export function useSupabase() {
  const { session } = useSession();
  return createSupabaseBrowserClient(
    { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    async () => session?.getToken() ?? null
  );
}
