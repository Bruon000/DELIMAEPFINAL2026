import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MainContent } from "@/components/layout/main-content";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ERP Serralheria",
  description:
    "ERP Industrial para Serralheria - Comercial, Produção, Estoque e Financeiro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          <SidebarProvider>
            <div className="min-h-screen bg-background">
              <Sidebar />

              <div className="flex min-h-screen flex-col">
                <Topbar />
                <MainContent>{children}</MainContent>
              </div>
            </div>
          </SidebarProvider>
        </Providers>

        <Toaster />
      </body>
    </html>
  );
}
