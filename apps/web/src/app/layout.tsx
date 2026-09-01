import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge — Collaborative ML Development",
  description: "Multiplayer workspace for ML model development with your team and AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
