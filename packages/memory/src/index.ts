import type { ProjectRef } from "@workspace/types";

export interface MemoryContext {
  conventions: string;
  architecture: string;
  decisions: string[];
}

export async function injectMemory(_project: ProjectRef): Promise<MemoryContext> {
  return {
    conventions: "",
    architecture: "",
    decisions: []
  };
}
