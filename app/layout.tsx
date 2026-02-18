import type { Metadata } from "next";
import { Source_Serif_4, Noto_Serif_JP, DM_Sans } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  variable: "--font-serif-jp",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SHINEN — Every thought gets a picture",
  description:
    "A thought capture tool where every card gets an image. Paste a URL, drop a photo, or let a gentle illustration fill the space.",
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${notoSerifJP.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
