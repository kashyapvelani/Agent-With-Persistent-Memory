"use client"

import { FolderClosed, type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

const items: [
    {
        title: string;
        url: string;
        icon: LucideIcon;
        isActive?: boolean;
    }
] = [{
    title: "Projects",
    url: "#",
    icon: FolderClosed,
    isActive: true,
}]

export function NavDashboard() {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <a href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
        ))}
        </SidebarMenu>
    </SidebarGroup>
  )
}
