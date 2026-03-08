"use client";

import * as React from "react";
import { useClerk, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";

function getOrgLetter(name: string) {
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
}

export function TeamSwitcher() {
  const { isMobile } = useSidebar();
  const [open, setOpen] = React.useState(false);
  const [isSwitching, setIsSwitching] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const { setActive, redirectToCreateOrganization } = useClerk();
  const { organization } = useOrganization();
  const { isLoaded, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const memberships = userMemberships.data ?? [];
  const activeMembership =
    memberships.find(
      (membership) => membership.organization.id === organization?.id,
    ) ?? memberships[0];

  async function switchOrganization(nextOrganizationId: string) {
    if (isSwitching || organization?.id === nextOrganizationId) return;
    setIsSwitching(true);
    try {
      await setActive({ organization: nextOrganizationId });
      setOpen(false);
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleCreateOrganization() {
    if (isCreating) return;
    setIsCreating(true);
    setOpen(false);
    try {
      await redirectToCreateOrganization();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex">
        <div className="flex items-center justify-center gap-4 p-4">
          <Avatar className="size-8 rounded-md! after:rounded-md!">
            <AvatarFallback className="rounded-md!">
              {getOrgLetter(
                activeMembership?.organization.name ?? "Organization",
              )}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">
              {activeMembership?.organization.name ?? "Select organization"}
            </span>
          </div>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="items-center justify-center"
              >
                <ChevronsUpDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Teams
              </DropdownMenuLabel>
              {memberships.map((membership) => {
                const orgId = membership.organization.id;
                const orgName = membership.organization.name;
                const isActive = organization?.id === orgId;

                return (
                  <DropdownMenuItem
                    key={orgId}
                    onClick={() => void switchOrganization(orgId)}
                    disabled={isSwitching}
                    className="gap-2 p-2"
                  >
                    <Avatar className="size-6 rounded-md! border after:rounded-md!">
                      <AvatarFallback className="rounded-md! text-[10px]">
                        {getOrgLetter(orgName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{orgName}</span>
                    <Check
                      className={cn(
                        "ml-auto size-4",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </DropdownMenuItem>
                );
              })}
              {memberships.length === 0 && (
                <DropdownMenuItem
                  disabled
                  className="p-2 text-muted-foreground"
                >
                  No organizations found.
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleCreateOrganization()}
                disabled={isCreating || isSwitching}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">
                  Create organization
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
