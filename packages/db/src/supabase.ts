import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@workspace/types";

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

/**
 * Browser / React client — passes the Clerk session token so Supabase RLS
 * policies receive a valid JWT on every request.
 *
 * Usage (inside a React component or hook):
 *   const { session } = useSession();  // from @clerk/nextjs
 *   const supabase = createSupabaseBrowserClient(
 *     { url, anonKey },
 *     () => session?.getToken() ?? null
 *   );
 */
export function createSupabaseBrowserClient(
  env: Pick<SupabaseEnv, "url" | "anonKey">,
  getToken: () => Promise<string | null>
): TypedSupabaseClient {
  return createClient<Database>(env.url, env.anonKey, {
    accessToken: getToken,
  });
}

/**
 * Server / agent client — uses the service role key, which bypasses RLS.
 * Use this in API routes and the LangGraph agent only.
 */
export function createSupabaseServiceRoleClient(
  env: Pick<SupabaseEnv, "url" | "serviceRoleKey">
): TypedSupabaseClient {
  return createClient<Database>(env.url, env.serviceRoleKey);
}
