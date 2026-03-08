import { SyncUser } from "@/components/sync-user";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SyncUser />
      {children}
    </>
  );
}
