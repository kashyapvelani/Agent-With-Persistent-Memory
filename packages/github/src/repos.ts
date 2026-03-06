import { Octokit } from "@octokit/rest";

// ----------------------------------------
// Types
// ----------------------------------------

export interface RepoSummary {
  id: number;
  fullName: string;
  url: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string; // decoded UTF-8
  sha: string;     // needed for update commits
  encoding: string;
}

// ----------------------------------------
// List repos accessible to the authenticated user (via OAuth token)
// ----------------------------------------

export async function listUserRepos(octokit: Octokit): Promise<RepoSummary[]> {
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    sort: "updated",
    per_page: 100,
  });

  return repos.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    url: r.html_url,
    defaultBranch: r.default_branch,
    private: r.private,
    description: r.description ?? null,
  }));
}

// ----------------------------------------
// Create a new empty repo (scratch projects)
// Requires administration:write scope on the GitHub App
// ----------------------------------------

export async function createRepo(
  octokit: Octokit,
  name: string,
  options: { private?: boolean; description?: string } = {}
): Promise<RepoSummary> {
  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    private: options.private ?? false,
    description: options.description ?? "Created by NexGenesis",
    auto_init: true, // creates initial commit so the repo isn't empty
  });

  return {
    id: data.id,
    fullName: data.full_name,
    url: data.html_url,
    defaultBranch: data.default_branch,
    private: data.private,
    description: data.description ?? null,
  };
}

// ----------------------------------------
// Get the full recursive file tree for a repo
// Used by the indexing pipeline and the frontend file tree panel
// ----------------------------------------

export async function getRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<TreeEntry[]> {
  // Resolve the branch to its commit SHA
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitSha = ref.object.sha;

  // Get the recursive tree
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commitSha,
    recursive: "1",
  });

  return (tree.tree ?? [])
    .filter((e): e is TreeEntry & { path: string; type: "blob" | "tree" } =>
      e.path !== undefined && (e.type === "blob" || e.type === "tree")
    )
    .map((e) => ({
      path: e.path,
      type: e.type,
      sha: e.sha ?? "",
      size: e.size,
    }));
}

// ----------------------------------------
// Get a single file's decoded content
// ----------------------------------------

export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<FileContent> {
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`${path} is not a file`);
  }

  const content =
    data.encoding === "base64"
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : data.content;

  return {
    path: data.path,
    content,
    sha: data.sha,
    encoding: data.encoding ?? "utf-8",
  };
}
