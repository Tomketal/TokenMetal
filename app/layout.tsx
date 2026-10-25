import type { Metadata } from "next";
import { Nunito, Press_Start_2P } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletProviders } from "./providers";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "800", "900"],
  variable: "--font-nunito"
});

const pixel = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel"
});

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
    <html lang="en" className={`${nunito.variable} ${pixel.variable}`}>
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
