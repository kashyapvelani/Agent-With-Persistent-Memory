import "dotenv/config";

// Re-export the compiled graph for LangGraph Cloud discovery
export { graph } from "./agent/graph.js";

export async function startAgent(): Promise<void> {
  console.log("ADE agent ready.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startAgent();
}
