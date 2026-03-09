"use client"

import { UserButton } from "@clerk/nextjs"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Slash } from "lucide-react"
import { ProjectSwitcher } from "./project-switcher"
import { TeamSwitcher } from "./team-switcher"

type SiteHeaderProps = {
  showProjectSwitcher?: boolean
}

export function SiteHeader({ showProjectSwitcher = false }: SiteHeaderProps) {

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex w-full h-(--header-height) items-center justify-between px-4">
        <Breadcrumb>
          <BreadcrumbList className="text-foreground">
            <BreadcrumbItem>
              <TeamSwitcher />
            </BreadcrumbItem>
            {showProjectSwitcher && (
              <>
                <BreadcrumbSeparator>
                  <Slash className="size-1.2 text-muted-foreground" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <ProjectSwitcher />
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <UserButton />
      </div>
    </header>
  )
}
