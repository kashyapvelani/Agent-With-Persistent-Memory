// ----------------------------------------
// Directories to skip entirely (any path segment matches)
// ----------------------------------------
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage",
  "__pycache__", ".venv", "venv", ".mypy_cache", ".pytest_cache",
  "out", ".turbo", ".cache", ".yarn", "vendor", ".svn", "target",
]);

// ----------------------------------------
// Extensions we can parse and embed
// ----------------------------------------
const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py",
]);

// ----------------------------------------
// Individual file patterns to always skip
// ----------------------------------------
const SKIP_SUFFIXES = [
  ".lock",
  ".min.js",
  ".min.css",
  ".d.ts",
  ".map",
];

const SKIP_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".gitignore",
  ".env",
  ".env.local",
]);

export function shouldIndex(filePath: string): boolean {
  const segments = filePath.split("/");

  // Skip if any directory segment is in the skip list
  for (let i = 0; i < segments.length - 1; i++) {
    if (SKIP_DIRS.has(segments[i]!)) return false;
  }

  const filename = segments[segments.length - 1]!;

  if (SKIP_FILENAMES.has(filename)) return false;
  if (SKIP_SUFFIXES.some((s) => filename.endsWith(s))) return false;

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filename.slice(dotIndex);

  return SUPPORTED_EXTENSIONS.has(ext);
}

export function detectLanguage(filePath: string): "typescript" | "javascript" | "python" {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".py")) return "python";
  return "javascript";
}
