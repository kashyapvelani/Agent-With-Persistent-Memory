import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Native tree-sitter bindings — loaded lazily to avoid import-time crashes
// if the native module hasn't been compiled yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Parser: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _grammars: { ts: any; tsx: any; js: any; py: any } | null = null;

function load() {
  if (_Parser) return;
  _Parser = require("tree-sitter");
  const TS = require("tree-sitter-typescript");
  const JS = require("tree-sitter-javascript");
  const PY = require("tree-sitter-python");
  _grammars = { ts: TS.typescript, tsx: TS.tsx, js: JS, py: PY };
}

// ----------------------------------------
// Types
// ----------------------------------------

export interface RawChunk {
  nodeType: string;
  nodeName: string;
  content: string;
  startLine: number;
  endLine: number;
}

// Node types we extract as standalone chunks
const TS_TARGET_TYPES = new Set([
  "function_declaration",
  "generator_function_declaration",
  "class_declaration",
  "abstract_class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "method_definition",
]);

const PY_TARGET_TYPES = new Set([
  "function_definition",
  "class_definition",
]);

// ----------------------------------------
// Extract the declared name from a node
// ----------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractName(node: any): string {
  const nameTypes = ["identifier", "type_identifier", "property_identifier"];
  for (const child of node.children ?? []) {
    if (nameTypes.includes(child.type)) return child.text as string;
  }
  return "<anonymous>";
}

// ----------------------------------------
// Walk AST and collect target chunks
// ----------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectChunks(node: any, targetTypes: Set<string>, results: RawChunk[], depth = 0) {
  if (targetTypes.has(node.type)) {
    results.push({
      nodeType: node.type,
      nodeName: extractName(node),
      content: node.text as string,
      startLine: node.startPosition.row as number,
      endLine: node.endPosition.row as number,
    });
    // Don't recurse into class bodies to avoid duplicating methods at top-level
    if (node.type === "class_declaration" || node.type === "abstract_class_declaration") return;
  }

  // For export statements, recurse into the declaration they wrap
  if (node.type === "export_statement" && depth === 0) {
    for (const child of node.children ?? []) {
      collectChunks(child, targetTypes, results, depth + 1);
    }
    return;
  }

  for (const child of node.children ?? []) {
    collectChunks(child, targetTypes, results, depth + 1);
  }
}

// ----------------------------------------
// Public: parse a file and return raw chunks
// ----------------------------------------
export function parseFile(
  filePath: string,
  content: string
): RawChunk[] {
  load();

  const ext = filePath.slice(filePath.lastIndexOf("."));
  let grammar: unknown;
  let targetTypes: Set<string>;

  if (ext === ".ts") {
    grammar = _grammars!.ts;
    targetTypes = TS_TARGET_TYPES;
  } else if (ext === ".tsx") {
    grammar = _grammars!.tsx;
    targetTypes = TS_TARGET_TYPES;
  } else if (ext === ".py") {
    grammar = _grammars!.py;
    targetTypes = PY_TARGET_TYPES;
  } else {
    grammar = _grammars!.js;
    targetTypes = TS_TARGET_TYPES;
  }

  const parser = new _Parser();
  parser.setLanguage(grammar);

  let tree;
  try {
    tree = parser.parse(content);
  } catch {
    // Unparseable file — fall back to whole-file chunk
    return [
      {
        nodeType: "module",
        nodeName: filePath.split("/").pop() ?? filePath,
        content,
        startLine: 0,
        endLine: content.split("\n").length - 1,
      },
    ];
  }

  const chunks: RawChunk[] = [];
  collectChunks(tree.rootNode, targetTypes, chunks);

  // For very small files (≤ 30 lines) or files with no extractable nodes,
  // index the whole file as a single "module" chunk.
  const lineCount = content.split("\n").length;
  if (chunks.length === 0 || lineCount <= 30) {
    return [
      {
        nodeType: "module",
        nodeName: filePath.split("/").pop() ?? filePath,
        content: content.slice(0, 12_000), // safety cap
        startLine: 0,
        endLine: lineCount - 1,
      },
    ];
  }

  return chunks;
}
