import { ProjectIdLayout } from "@/features/project/components/project-id-layout";

const Layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string; threadId: string }>;
}) => {
  const { projectId, threadId } = await params;

  return (
    <ProjectIdLayout projectId={projectId} threadId={threadId}>
      {children}
    </ProjectIdLayout>
  );
};

export default Layout;
