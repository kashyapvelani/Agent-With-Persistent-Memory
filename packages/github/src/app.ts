import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

export interface GitHubAppEnv {
  appId: string;
  privateKey: string; // PEM — newlines can be literal \n in env var
}

/**
 * Creates the GitHub App instance.
 * Use this once per process (singleton pattern in your server).
 */
export function createGitHubApp(env: GitHubAppEnv): App {
  return new App({
    appId: env.appId,
    // Railway / process.env stores \n as literal backslash-n — normalise here
    privateKey: env.privateKey.replace(/\\n/g, "\n"),
  });
}

/**
 * Returns an Octokit client authenticated for a specific installation.
 * The token is automatically refreshed by @octokit/app (1-hour expiry).
 */
export async function getInstallationOctokit(
  app: App,
  installationId: number
): Promise<Octokit> {
  return app.getInstallationOctokit(installationId) as unknown as Octokit;
}

/**
 * Lightweight REST client for unauthenticated or user-token requests
 * (e.g. listing a user's repos via their OAuth token from Clerk).
 */
export function createUserOctokit(userToken: string): Octokit {
  return new Octokit({ auth: userToken });
}
