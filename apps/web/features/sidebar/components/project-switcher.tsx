'use client'

import { Project } from "@workspace/types"
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react"

export const ProjectSwitcher = () => {
    const { projectId } = useParams<{ projectId?: string | string[] }>();
    const activeProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);


    const fetchProjects = useCallback(async () => {
        setLoading(true)
        const res = await fetch("/api/projects")
        const data = await res.json()
        setProjects((data as Project[]) ?? [])
        setLoading(false)
      }, [])

    const fetchProjectById = useCallback(async (id: string) => {
        if (!id) {
          setCurrentProject(null)
          return
        }

        setLoading(true)
        const res = await fetch(`/api/projects/${id}`)
        if (!res.ok) {
          setCurrentProject(null)
          setLoading(false)
          return
        }
        const data = (await res.json()) as { project?: Project }
        setCurrentProject(data.project ?? null)
        setLoading(false)
      }, [])

      useEffect(() => {
          fetchProjects()
      }, [fetchProjects])

      useEffect(() => {
        if (!activeProjectId) {
          setCurrentProject(null)
          return
        }
        fetchProjectById(activeProjectId)
      }, [activeProjectId, fetchProjectById])

      const currentProjectName =
        currentProject?.repoFullName ??
        projects.find((project) => project.id === activeProjectId)?.repoFullName ??
        "Select project"

    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Link href={`/dashboard/project/${currentProject?.id}/thread/new`}>
        <div className="px-2">
            <span className="max-w-56 truncate text-sm font-medium">
              {currentProjectName}
            </span>
        </div>
        </Link>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 gap-2 px-2"
            disabled={loading && projects.length === 0}
          >
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-64 rounded-lg"
          align="start"
          side="bottom"
          sideOffset={8}
        >
          <DropdownMenuLabel className="text-xs text text-muted-foreground">
            PROJECTS
          </DropdownMenuLabel>
          {projects.map((project) => {
            const isActive = activeProjectId === project.id

            return (
              <DropdownMenuItem
                key={project.id}
                onClick={() => {
                  setOpen(false)
                  router.push(`/dashboard/project/${project.id}`)
                }}
                className="gap-2 p-2"
              >
                <span className="truncate">{project.repoFullName}</span>
                <Check
                  className={cn(
                    "ml-auto size-4",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            );
          })}
          {projects.length === 0 && (
            <DropdownMenuItem disabled className="p-2 text-muted-foreground">
              No projects found.
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
}
