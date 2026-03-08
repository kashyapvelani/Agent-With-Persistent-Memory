"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

export function SyncUser() {
  const { isSignedIn } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (isSignedIn && !synced.current) {
      synced.current = true;
      fetch("/api/auth/sync", { method: "POST" }).catch(console.error);
    }
  }, [isSignedIn]);

  return null;
}
