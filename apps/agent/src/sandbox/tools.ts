import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { Sandbox } from "e2b";

const WORKSPACE_DIR = "/workspace";

function abs(path: string): string {
  // Ensure every path is absolute inside the sandbox workspace
  if (path.startsWith("/")) return path;
  return `${WORKSPACE_DIR}/${path}`;
}

/**
 * Builds the full set of Claude Code-style filesystem + shell tools
 * bound to a specific E2B sandbox instance.
 *
 * Pass the returned array to model.bindTools() in CoderNode.
 */
export function buildSandboxTools(sandbox: Sandbox) {
  const readFile = tool(
    async ({ path }) => {
      try {
        const content = await sandbox.files.read(abs(path));
        return content;
      } catch (err) {
        return `ERROR: Could not read file "${path}": ${String(err)}`;
      }
    },
    {
      name: "read_file",
      description:
        "Read the full contents of a file in the repository. Use this before editing a file so you know exactly what's there.",
      schema: z.object({
        path: z.string().describe("Path to the file, relative to the repo root (e.g. src/index.ts)"),
      }),
    }
  );

  const writeFile = tool(
    async ({ path, content }) => {
      try {
        await sandbox.files.write(abs(path), content);
        return `Written: ${path}`;
      } catch (err) {
        return `ERROR: Could not write file "${path}": ${String(err)}`;
      }
    },
    {
      name: "write_file",
      description:
        "Create a new file or completely overwrite an existing file. Prefer edit_file for targeted changes to existing files.",
      schema: z.object({
        path: z.string().describe("Path to the file, relative to repo root"),
        content: z.string().describe("Full file content to write"),
      }),
    }
  );

  const editFile = tool(
    async ({ path, old_str, new_str }) => {
      try {
        const current = await sandbox.files.read(abs(path));
        if (!current.includes(old_str)) {
          return `ERROR: old_str not found in "${path}". Read the file first and use an exact match.`;
        }
        const updated = current.replace(old_str, new_str);
        await sandbox.files.write(abs(path), updated);
        return `Edited: ${path}`;
      } catch (err) {
        return `ERROR: Could not edit file "${path}": ${String(err)}`;
      }
    },
    {
      name: "edit_file",
      description:
        "Make a precise edit to an existing file by replacing an exact string with new content. old_str must be a unique, verbatim snippet from the file — include enough surrounding lines to be unambiguous. Preferred over write_file for targeted changes.",
      schema: z.object({
        path: z.string().describe("Path to the file, relative to repo root"),
        old_str: z.string().describe("Exact string to find and replace (must be unique in the file)"),
        new_str: z.string().describe("Replacement string"),
      }),
    }
  );

  const deleteFile = tool(
    async ({ path }) => {
      try {
        await sandbox.files.remove(abs(path));
        return `Deleted: ${path}`;
      } catch (err) {
        return `ERROR: Could not delete "${path}": ${String(err)}`;
      }
    },
    {
      name: "delete_file",
      description: "Delete a file from the repository.",
      schema: z.object({
        path: z.string().describe("Path to the file, relative to repo root"),
      }),
    }
  );

  const listDirectory = tool(
    async ({ path }) => {
      try {
        const entries = await sandbox.files.list(abs(path));
        return entries.map((e) => `${e.type === "dir" ? "[dir]" : "[file]"} ${e.name}`).join("\n");
      } catch (err) {
        return `ERROR: Could not list "${path}": ${String(err)}`;
      }
    },
    {
      name: "list_directory",
      description: "List files and subdirectories in a directory.",
      schema: z.object({
        path: z
          .string()
          .default(".")
          .describe("Directory path relative to repo root. Use '.' for the repo root."),
      }),
    }
  );

  const glob = tool(
    async ({ pattern }) => {
      try {
        const result = await sandbox.commands.run(
          `find ${WORKSPACE_DIR} -path "${WORKSPACE_DIR}/.git" -prune -o -path "*/${pattern.replace(/\*\*/g, "*")}" -print 2>/dev/null | sed "s|${WORKSPACE_DIR}/||g" | head -100`
        );
        return result.stdout.trim() || "No matches found.";
      } catch (err) {
        return `ERROR: glob failed: ${String(err)}`;
      }
    },
    {
      name: "glob",
      description:
        "Find files matching a glob pattern across the repo. Example patterns: '**/*.ts', 'src/**/*.test.ts', '**/package.json'",
      schema: z.object({
        pattern: z.string().describe("Glob pattern to search for"),
      }),
    }
  );

  const searchFiles = tool(
    async ({ pattern, path, include }) => {
      try {
        const searchPath = path ? abs(path) : WORKSPACE_DIR;
        const includeFlag = include ? `--include="${include}"` : "--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.py'";
        const result = await sandbox.commands.run(
          `grep -r --line-number ${includeFlag} "${pattern}" "${searchPath}" 2>/dev/null | grep -v ".git/" | head -50`
        );
        return result.stdout.trim() || "No matches found.";
      } catch (err) {
        return `ERROR: search failed: ${String(err)}`;
      }
    },
    {
      name: "search_files",
      description:
        "Search for a text pattern across files in the repo (like grep). Returns matching lines with file paths and line numbers.",
      schema: z.object({
        pattern: z.string().describe("Text or regex pattern to search for"),
        path: z
          .string()
          .optional()
          .describe("Directory to search in (relative to repo root). Defaults to entire repo."),
        include: z
          .string()
          .optional()
          .describe("File pattern to restrict search, e.g. '*.ts'. Defaults to common source files."),
      }),
    }
  );

  const runCommand = tool(
    async ({ command }) => {
      try {
        const result = await sandbox.commands.run(command, {
          cwd: WORKSPACE_DIR,
          timeoutMs: 2 * 60 * 1000,
        });
        const out = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        return out || `(exit code: ${result.exitCode})`;
      } catch (err) {
        return `ERROR: Command failed: ${String(err)}`;
      }
    },
    {
      name: "run_command",
      description:
        "Run a shell command inside the sandbox (working directory: repo root). Use this to run tests, install packages, check for errors, or inspect runtime behaviour. Do NOT use for file edits — use edit_file or write_file instead.",
      schema: z.object({
        command: z.string().describe("Shell command to run"),
      }),
    }
  );

  return [readFile, writeFile, editFile, deleteFile, listDirectory, glob, searchFiles, runCommand];
}
