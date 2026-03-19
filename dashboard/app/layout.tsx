import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "crypto-bot dashboard",
  description: "Binance crypto Donchian breakout paper trading dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
