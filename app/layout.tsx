import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Serif_JP, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SHINEN",
  },
  icons: {
    apple: "/enso.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#fdfdfd",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${notoSerifJP.variable} ${dmSans.variable}`}
    >
      <body>
        {children}
        <Script id="sw-register" strategy="afterInteractive">{`
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
`}</Script>
      </body>
    </html>
  );
}
