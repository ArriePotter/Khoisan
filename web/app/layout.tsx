import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Khoisān",
  description: "Adaptive training plans and progress for MUT 60 by UTMB.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Khoisān", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AuthProvider>
          <Nav />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:pb-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
