import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SessionWrapper from "@/components/SessionWrapper";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SentinelAI — Weekly Income Protection",
  description: "AI-enabled parametric insurance platform for gig worker income protection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrains.variable}`}>
      <body className="bg-background min-h-screen">
        <SessionWrapper>
          <Navbar />
          <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        </SessionWrapper>
      </body>
    </html>
  );
}
