import type { Metadata } from "next";
import { Starfield } from "@/components/layout/Starfield";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenClaw Mission Control",
  description: "Dashboard for managing OpenClaw agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="text-text-primary antialiased">
        <Starfield />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
