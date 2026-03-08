"use client"

import { UserButton } from "@clerk/nextjs"
import { TeamSwitcher } from "./team-switcher"


export function SiteHeader() {

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex w-full h-(--header-height) items-center gap-2 px-4 justify-between">
        <TeamSwitcher />
        <UserButton />
      </div>
    </header>
  )
}
