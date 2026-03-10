"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Folder, Forward, MessageSquare, MoreHorizontal, SquarePen, Trash2 } from "lucide-react"
import type { Session } from "@workspace/types"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { useWorkspace } from "@/features/project/hooks/use-workspace"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"

export function NavProject() {
  const {
    projectId,
    activeSessionId,
    sessionsVersion,
  } = useWorkspace()

  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    if (!projectId) return

    let cancelled = false
    async function fetchSessions() {
      try {
        const res = await fetch(
          `/api/sessions?projectId=${encodeURIComponent(projectId)}`,
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSessions(data)
        }
      } catch {
        // Silently fail — sidebar is not critical
      }
    }
    fetchSessions()
    return () => { cancelled = true }
  }, [projectId, sessionsVersion])

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New Chat"
              asChild
            >
              <Link href={`/dashboard/project/${projectId}/thread/new`}>
                <SquarePen />
                <span>New Chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {sessions.length > 0 && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>HISTORY</SidebarGroupLabel>
          <SidebarMenu className="gap-2">
            {sessions.map((session) => (
              <SidebarMenuItem key={session.id}>
                <SidebarMenuButton
                  asChild
                  variant="default"
                >
                  <Link
                    href={`/dashboard/project/${projectId}/thread/${session.id}`}
                  >
                    <span className="truncate">
                      {session.title ?? `Chat ${timeAgo(session.createdAt)}`}
                    </span>
                  </Link>
                </SidebarMenuButton>
                <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={"right"}
                align={"start"}
              >
                <DropdownMenuItem>
                  <Folder className="text-muted-foreground" />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="text-muted-foreground" />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Trash2 className="text-muted-foreground" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}
