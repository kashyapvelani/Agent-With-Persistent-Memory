"use client";

import { useContext } from "react";
import { WorkspaceContext } from "../components/workspace-provider";

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
};
