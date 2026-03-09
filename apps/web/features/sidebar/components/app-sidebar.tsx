"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { NavDashboard } from "./nav-dashboard"
import { NavProject } from "./nav-project"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { projectId } = useParams<{ projectId?: string | string[] }>()
  const activeProjectId = Array.isArray(projectId) ? projectId[0] : projectId
  const isProjectPage = Boolean(activeProjectId)

  return (
    <Sidebar collapsible="icon" className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" {...props}>
      <SidebarContent>
        {isProjectPage ? <NavProject /> : <NavDashboard />}
      </SidebarContent>
      <SidebarFooter>
        <div className="items-center">
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
