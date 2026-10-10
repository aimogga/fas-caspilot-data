import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@/lib/branding";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: PRODUCT_NAME
    ? { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` }
    : PRODUCT_NAME,
  description: "Local development shell for Public Data to Proof",
};

const fontVariables = `${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
