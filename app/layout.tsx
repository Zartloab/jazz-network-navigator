import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Hamed Artist Manager",
  description: "Campaign-based artist management for tours, releases, relationships, opportunities and outreach.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
