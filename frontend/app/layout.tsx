import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PersonaLens",
  description: "AI-powered UI evaluation through the lens of your personas"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body suppressHydrationWarning style={{ fontFamily: "var(--font-inter), 'Segoe UI', sans-serif" }}>
        <div className="flex h-screen min-h-0">
          <Sidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 lg:px-8 lg:py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
