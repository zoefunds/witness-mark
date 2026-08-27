import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NavHeader } from "@/components/NavHeader";
import { Footer } from "@/components/Footer";
import { ContractBanner } from "@/components/ContractBanner";

export const metadata: Metadata = {
  title: "WitnessMark — Make promises that survive contact with reality",
  description:
    "Stake GEN behind a real-world promise. A GenLayer Intelligent Contract adjudicates the outcome from evidence and pays out the stake accordingly.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <Providers>
          <NavHeader />
          <ContractBanner />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
