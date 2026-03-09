"use client"

import { Boxes, Clock, GitBranch, Plus } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { Project } from "@workspace/types"
import Link from "next/link"
import type { IndexingProgress } from "../../../hooks/useIndexingProgress"
import { CircularProgress } from "./circular-progress"

type IndexStatus = Project["indexStatus"]

const statusVariant: Record<IndexStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  indexing: "secondary",
  pending: "outline",
  failed: "destructive",
}

type ProjectCardsProps = {
  loading: boolean
  filtered: Project[]
  search: string
  progressMap: Map<string, IndexingProgress>
  onNewProject: () => void
}

export function ProjectCards({
  loading,
  filtered,
  search,
  progressMap,
  onNewProject,
}: ProjectCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <Empty className="min-h-75 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Boxes />
          </EmptyMedia>
          <EmptyTitle>{search ? "No projects found" : "No projects yet"}</EmptyTitle>
          <EmptyDescription>
            {search
              ? "Try a different search term."
              : "Connect a GitHub repository to get started."}
          </EmptyDescription>
        </EmptyHeader>
        {!search && (
          <Button onClick={onNewProject}>
            <Plus />
            New Project
          </Button>
        )}
      </Empty>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((project) => {
        const progress = progressMap.get(project.id)
        const isIndexing =
          project.indexStatus === "pending" || project.indexStatus === "indexing"
        const hasTotal = typeof progress?.totalfiles === "number" && progress.totalfiles > 0

        let percent = 0
        if (hasTotal && progress) {
          percent = (progress.indexedfiles / progress.totalfiles) * 100
        }

        return (
          <Link
            href={`/dashboard/project/${project.id}`}
            key={project.id}
            className="transition-colors hover:border-foreground/20 hover:cursor-pointer"
          >
            <Card className="transition-colors hover:border-foreground/20 hover:cursor-pointer">
              <CardHeader>
                <CardTitle className="truncate">{project.repoFullName}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <GitBranch className="size-3.5" />
                  {project.defaultBranch}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[project.indexStatus]}>
                      {project.indexStatus.toUpperCase()}
                    </Badge>
                    {isIndexing && (
                      <CircularProgress
                        value={percent}
                        size={24}
                        strokeWidth={2.5}
                        indeterminate={!hasTotal}
                      />
                    )}
                  </div>
                  {project.lastIndexedAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(project.lastIndexedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
