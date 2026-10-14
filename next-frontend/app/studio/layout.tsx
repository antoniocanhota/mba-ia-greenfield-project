import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SideNav } from "@/components/layout/side-nav";
import { UploadProvider } from "@/components/studio/upload-provider";
import { getSession } from "@/lib/auth/session";

export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  return (
    <UploadProvider>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </UploadProvider>
  );
}
