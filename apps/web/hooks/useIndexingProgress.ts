"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Project } from "@workspace/types"

export interface IndexingProgress {
  indexstatus: string
  indexedfiles: number
  totalfiles: number | null
  currentfile: string | null
  jobstatus: string | null
  error: string | null
}

const POLL_INTERVAL_MS = 2_000

/**
 * Polls indexing progress for projects in "pending" or "indexing" state.
 * Returns a Map<projectId, IndexingProgress>.
 * Calls `onComplete` when any project transitions to "ready" or "failed".
 */
export function useIndexingProgress(
  projects: Project[],
  onComplete?: () => void
): Map<string, IndexingProgress> {
  const [progressMap, setProgressMap] = useState<Map<string, IndexingProgress>>(new Map())
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Track which project IDs were previously active so we can detect completion
  const prevActiveRef = useRef<Set<string>>(new Set())

  const activeProjects = projects.filter(
    (p) => p.indexStatus === "pending" || p.indexStatus === "indexing"
  )

  const poll = useCallback(async (projectIds: string[]) => {
    const results = await Promise.allSettled(
      projectIds.map(async (id) => {
        const res = await fetch(`/api/projects/${id}/progress`)
        if (!res.ok) return null
        const data = (await res.json()) as IndexingProgress
        return { id, data }
      })
    )

    setProgressMap((prev) => {
      const next = new Map(prev)
      let anyCompleted = false

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) continue
        const { id, data } = result.value
        next.set(id, data)

        // Detect completion transition
        if (
          (data.indexstatus === "ready" || data.indexstatus === "failed") &&
          prevActiveRef.current.has(id)
        ) {
          anyCompleted = true
        }
      }

      if (anyCompleted) {
        // Defer callback to avoid updating state during render
        setTimeout(() => onCompleteRef.current?.(), 0)
      }

      return next
    })
  }, [])

  useEffect(() => {
    const ids = activeProjects.map((p) => p.id)
    prevActiveRef.current = new Set(ids)

    if (ids.length === 0) return

    // Poll immediately
    poll(ids)

    const interval = setInterval(() => poll(ids), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [activeProjects.map((p) => p.id).join(","), poll])

  return progressMap
}
