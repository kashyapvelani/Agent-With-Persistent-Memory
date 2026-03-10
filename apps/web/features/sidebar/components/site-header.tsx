"use client"

import dynamic from "next/dynamic"

// Clerk's UserButton renders differently on server vs client, causing hydration mismatch.
// Dynamic import with ssr:false ensures it only renders on the client.
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => ({ default: mod.UserButton })),
  { ssr: false },
)
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
