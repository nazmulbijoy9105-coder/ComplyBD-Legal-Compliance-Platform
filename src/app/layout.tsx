import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ComplyBD — Legal Compliance Platform",
  description:
    "Statutory compliance platform for Bangladesh public limited listed companies — RJSC, BSEC, DSE & CSE, NBR, Department of Labour, Bangladesh Bank and NDGA.",
  keywords: [
    "legal compliance",
    "Bangladesh",
    "RJSC",
    "BSEC",
    "NBR",
    "listed companies",
    "statutory filings",
  ],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-100 text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
