import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Bungee, DM_Sans } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const bungee = Bungee({
  subsets: ["latin"],
  variable: "--font-bungee-next",
  weight: "400",
});

export const metadata: Metadata = {
  description: "Panel de participantes y organización de HackSpain 2026.",
  icons: {
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
    icon: [{ url: "/icon.png", type: "image/png" }],
  },
  robots: { follow: false, index: false },
  title: "HackSpain",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="es"
        data-scroll-behavior="smooth"
        className={`${dmSans.variable} ${bungee.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-hs-paper text-hs-ink">
          <ConvexClientProvider>
            <AuthGate>
              <AppShell>{children}</AppShell>
            </AuthGate>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
