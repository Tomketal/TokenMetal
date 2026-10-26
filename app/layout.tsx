import type { Metadata } from "next";
import { Nunito, Press_Start_2P, Inter, JetBrains_Mono } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap"
});

export const metadata: Metadata = {
  title: "TokenMetal | Guided Stellar Investing",
  description: "Stellar investing made easy. Three inputs in, one confident trade out.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${pixel.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
