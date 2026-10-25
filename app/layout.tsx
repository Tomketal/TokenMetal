import type { Metadata } from "next";
import "./globals.css";
import { WalletProviders } from "./providers";

export const metadata: Metadata = {
  title: "Token Metal | Guided Stellar Investing",
  description: "Stellar investing made easy. Three inputs in, one confident trade out.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
