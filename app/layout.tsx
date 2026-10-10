import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Local development shell for Public Data to Proof",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
