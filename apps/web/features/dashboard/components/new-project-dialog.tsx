"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Lock, Globe, Loader2, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"


interface RepoSummary {
  id: number
  fullName: string
  url: string
  defaultBranch: string
  private: boolean
  description: string | null
}

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: () => void
}

export function NewProjectDialog({ open, onOpenChange, onProjectCreated }: NewProjectDialogProps) {
  const [repos, setRepos] = useState<RepoSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<RepoSummary | null>(null)

  const fetchRepos = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/github/repos")
    const data = await res.json()
    setRepos(data.repos ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) {
      fetchRepos()
      setSelected(null)
      setSearch("")
    }
  }, [open, fetchRepos])

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    if (!selected) return
    setCreating(true)

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoFullName: selected.fullName,
        repoUrl: selected.url,
        defaultBranch: selected.defaultBranch,
      }),
    })

    if (res.ok) {
      onProjectCreated()
      onOpenChange(false)
    }

    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Select a GitHub repository to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-64 w-full">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No repositories found." : "No repositories available."}
            </p>
          ) : (
            <div className="flex w-full flex-col gap-1 pr-3">
              {filtered.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => setSelected(repo)}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                    selected?.id === repo.id
                      ? "bg-muted ring-1 ring-ring"
                      : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="font-medium break-all">{repo.fullName}</span>
                      {repo.private ? (
                        <Lock className="size-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <Globe className="size-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal wrap-break-word">
                        {repo.description}
                      </p>
                    )}
                  </div>
                  {selected?.id === repo.id && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!selected || creating}
            onClick={handleCreate}
          >
            {creating && <Loader2 className="animate-spin" />}
            {creating ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
