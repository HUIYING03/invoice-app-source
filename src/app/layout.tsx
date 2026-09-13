import type { Metadata, Viewport } from "next";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice & Quotation",
  description: "Type a job on your phone and get a printable invoice or quotation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4e89",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-dvh pb-24 print:pb-0">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
