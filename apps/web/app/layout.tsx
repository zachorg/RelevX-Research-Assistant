/**
 * Root layout for Next.js app
 */

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { Navbar } from "@/components/navigation/navbar";

export const metadata: Metadata = {
  title: "RelevX - AI-Powered Research Assistant",
  description:
    "Set-and-forget research assistant that delivers curated insights straight to your inbox",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
