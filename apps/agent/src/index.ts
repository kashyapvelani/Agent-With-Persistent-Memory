import "dotenv/config";

export async function startAgent(): Promise<void> {
  // Placeholder bootstrap for the LangGraph agent runtime.
  console.log("agent started");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startAgent();
}
