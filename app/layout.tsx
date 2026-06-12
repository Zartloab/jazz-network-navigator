import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Jazz Network Navigator",
  description: "AI-powered relationship radar for booking, festivals, labels, venues and press.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
