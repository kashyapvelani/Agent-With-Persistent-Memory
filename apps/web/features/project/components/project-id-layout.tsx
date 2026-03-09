"use client";
;
import { AppSidebar } from "@/features/sidebar/components/app-sidebar";
import { SiteHeaderProject } from "@/features/sidebar/components/site-header-project";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { Allotment } from "allotment";

export const ProjectIdLayout = ({ 
    children,
    projectId
 }: { 
    children: React.ReactNode 
    projectId: string,
} ) => {
    return (
        <div className="[--header-height:calc(--spacing(14))]">
            <SidebarProvider className="flex flex-col">
                <SiteHeaderProject />
                <div className="flex flex-1">
                  <AppSidebar />
                  <SidebarInset>
                    <div className="flex flex-1 flex-col gap-4 p-4">
                      {children}
                    </div>
                  </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    );
}