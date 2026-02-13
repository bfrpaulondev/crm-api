import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ApolloProviderWrapper } from "@/lib/apollo/provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM Platform - Enterprise Sales Management",
  description: "Modern CRM platform with lead management, pipeline tracking, and sales analytics. Built with Next.js, TypeScript, and GraphQL.",
  keywords: ["CRM", "Sales", "Pipeline", "Leads", "Sales Management", "Next.js", "TypeScript"],
  authors: [{ name: "CRM Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "CRM Platform",
    description: "Enterprise-grade CRM solution for modern sales teams",
    type: "website",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ApolloProviderWrapper>
          {children}
        </ApolloProviderWrapper>
      </body>
    </html>
  );
}
