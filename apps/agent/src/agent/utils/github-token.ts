import { createGitHubApp, getInstallationOctokit } from "@workspace/github";
import type { TypedSupabaseClient } from "@workspace/db";

/**
 * Mints a GitHub installation token for sandbox cloning.
 * Falls back to GITHUB_TOKEN env var ONLY if no installation ID is available.
 *
 * If an installation ID is provided but token minting fails, this throws —
 * silently falling back would hide real auth issues and cause confusing
 * "clone failed" errors downstream.
 */
export async function getGitHubToken(
  githubInstallationId: number | null,
  _supabase: TypedSupabaseClient
): Promise<string> {
  // ── Path 1: Mint installation token (preferred) ────────────────────────────
  if (githubInstallationId) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error(
        `[getGitHubToken] GitHub App credentials missing. ` +
        `GITHUB_APP_ID=${appId ? "set" : "MISSING"}, ` +
        `GITHUB_APP_PRIVATE_KEY=${privateKey ? "set" : "MISSING"}. ` +
        `These are required to mint installation tokens for repo cloning.`
      );
    }

    const app = createGitHubApp({ appId, privateKey });
    const octokit = await getInstallationOctokit(app, githubInstallationId);
    const auth = await octokit.auth({ type: "installation" });

    let token: string | undefined;
    if (typeof auth === "string") {
      token = auth;
    } else if (auth && typeof auth === "object" && "token" in auth) {
      const extracted = (auth as { token?: unknown }).token;
      if (typeof extracted === "string") token = extracted;
    }

    if (!token) {
      throw new Error(
        `[getGitHubToken] Failed to extract token from GitHub App auth response ` +
        `for installation ${githubInstallationId}. ` +
        `Auth response type: ${typeof auth}, keys: ${auth && typeof auth === "object" ? Object.keys(auth).join(", ") : "N/A"}`
      );
    }

    // Log token prefix for debugging (never log the full token)
    const prefix = token.slice(0, 8);
    console.log(
      `[getGitHubToken] Minted installation token for installation ${githubInstallationId} ` +
      `(prefix: ${prefix}..., length: ${token.length})`
    );
    return token;
  }

  // ── Path 2: Fallback to GITHUB_TOKEN env var ───────────────────────────────
  // Only used when no GitHub App installation is linked to the project.
  const fallbackToken = process.env.GITHUB_TOKEN ?? "";
  if (!fallbackToken) {
    console.warn(
      "[getGitHubToken] No githubInstallationId and no GITHUB_TOKEN env var. " +
      "Clone will only work for public repos."
    );
  }
  return fallbackToken;
}
