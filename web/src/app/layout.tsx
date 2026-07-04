import type { Metadata } from "next";
import "./globals.css";
import { AuthRealtimeSync } from "@/components/AuthRealtimeSync";
import { ServiceWorkerCleanup } from "@/components/ServiceWorkerCleanup";


export const metadata: Metadata = {
  title: "Spentgapa Dashboard",
  description: "Dashboard Manajemen SMPN 3 Pacet",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SPENTGAPA",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
    themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <AuthRealtimeSync />
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
