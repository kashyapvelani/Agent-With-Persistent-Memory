"use client"

import { useEffect, useState, useCallback } from "react"
import { useOrganization } from "@clerk/nextjs"
import { Plus, Search, Github } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@workspace/ui/components/empty"
import type { Project } from "@workspace/types"

import { NewProjectDialog } from "./new-project-dialog"
import { ProjectCards } from "./project-cards"
import { useIndexingProgress } from "../../../hooks/useIndexingProgress"

export function ProjectGrid() {
  const { organization } = useOrganization()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/projects")
    const data = await res.json()
    setProjects((data as Project[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!organization) return
    fetchProjects()
  }, [organization, fetchProjects])

  // Check GitHub connection — wait briefly for SyncUser to finish creating the org row
  useEffect(() => {
    if (!organization) return
    let cancelled = false
    async function checkGithub(retries = 2) {
      const res = await fetch("/api/github/repos")
      const data = await res.json()
      if (!data.connected && retries > 0 && !cancelled) {
        // SyncUser may still be creating the org row — retry after a short delay
        await new Promise((r) => setTimeout(r, 1500))
        return checkGithub(retries - 1)
      }
      if (!cancelled) setGithubConnected(data.connected)
    }
    checkGithub()
    return () => { cancelled = true }
  }, [organization])

  const filtered = projects.filter((p) =>
    p.repoFullName.toLowerCase().includes(search.toLowerCase())
  )
  const progressMap = useIndexingProgress(projects, fetchProjects)

  const githubAppLink = process.env.NEXT_PUBLIC_GITHUB_APP_PUBLIC_LINK
  const installUrl = githubAppLink && organization
    ? `${githubAppLink}/installations/new?state=${organization.id}`
    : null

  // Still checking GitHub connection
  if (githubConnected === null) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl">Projects</h1>
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
      </div>
    )
  }

  // GitHub not connected — prompt to connect
  if (!githubConnected) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl">Projects</h1>
        <Empty className="min-h-75 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Github />
            </EmptyMedia>
            <EmptyTitle>Connect GitHub</EmptyTitle>
            <EmptyDescription>
              Connect your GitHub account to start creating projects.
            </EmptyDescription>
          </EmptyHeader>
          {installUrl ? (
            <Button asChild>
              <a href={installUrl}>
                <Github />
                Connect to GitHub
              </a>
            </Button>
          ) : (
            <Button disabled>
              <Github />
              GitHub App not configured
            </Button>
          )}
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">Projects</h1>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          New Project
        </Button>
      </div>

      <ProjectCards
        loading={loading}
        filtered={filtered}
        search={search}
        progressMap={progressMap}
        onNewProject={() => setDialogOpen(true)}
      />

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onProjectCreated={fetchProjects}
      />
    </div>
  )
}
