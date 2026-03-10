"use client";

import { AppSidebar } from "@/features/sidebar/components/app-sidebar";
import { SiteHeaderProject } from "@/features/sidebar/components/site-header-project";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { WorkspaceProvider } from "./workspace-provider";
import { WorkspacePanels } from "./workspace-panels";

export const ProjectIdLayout = ({
    children,
    projectId,
    threadId,
 }: {
    children: React.ReactNode
    projectId: string,
    threadId: string,
} ) => {
    return (
        <div className="[--header-height:calc(--spacing(14))]">
            <WorkspaceProvider projectId={projectId} threadId={threadId}>
                <SidebarProvider className="flex flex-col">
                    <SiteHeaderProject />
                    <div className="flex flex-1">
                      <AppSidebar />
                      <SidebarInset>
                        <WorkspacePanels>{children}</WorkspacePanels>
                      </SidebarInset>
                    </div>
                </SidebarProvider>
            </WorkspaceProvider>
        </div>
    );
}
