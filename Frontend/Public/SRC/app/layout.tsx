import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StellarLend — Borrow against your XLM",
  description:
    "Deposit XLM as collateral, borrow USDC, and track your health factor in real time on Stellar testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface-0 text-ink-0 font-body">
        {children}
      </body>
    </html>
  );
}
