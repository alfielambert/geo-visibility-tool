import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { ProjectProvider } from "@/lib/project-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Visibility Dashboard",
  description: "Monitor AI visibility and recommendations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ProjectProvider>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </ProjectProvider>
      </body>
    </html>
  );
}
