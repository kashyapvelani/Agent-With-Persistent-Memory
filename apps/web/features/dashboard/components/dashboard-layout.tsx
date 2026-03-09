
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { SiteHeader } from "../../sidebar/components/site-header"
import { ProjectGrid } from "./project-grid"
import { AppSidebar } from "@/features/sidebar/components/app-sidebar";

export const iframeHeight = "800px"

export const description = "A sidebar with a header and a search form."

export const DashboardLayout = () => {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <ProjectGrid />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
