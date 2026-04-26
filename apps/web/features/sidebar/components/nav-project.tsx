"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

export function NavProject() {
  const {
    projectId,
    activeSessionId,
    sessionsVersion,
  } = useWorkspace()
  const router = useRouter()

  const [sessions, setSessions] = useState<Session[]>([])
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Failed to delete session")
      setSessions((prev) => prev.filter((s) => s.id !== target.id))
      setPendingDelete(null)
      if (activeSessionId === target.id) {
        router.push(`/dashboard/project/${projectId}/thread/new`)
      }
    } catch (err) {
      console.error("Delete session failed:", err)
    } finally {
      setIsDeleting(false)
    }
  }

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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title
                ? `"${pendingDelete.title}" will be permanently removed.`
                : "This chat will be permanently removed."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <span>View Chat</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="text-muted-foreground" />
                  <span>Share Chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setPendingDelete(session)}
                >
                  <Trash2 />
                  <span>Delete chat</span>
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
