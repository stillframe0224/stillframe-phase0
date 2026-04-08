import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://magmawatch.vercel.app"),
  title: "MagmaWatch — Discourse Shift Observatory",
  description: "同じ出来事が、世界のどこで、誰に、どう異なって受け止められているか。そのズレから構造変化を読む。",
  openGraph: {
    title: "MagmaWatch — Discourse Shift Observatory",
    description:
      "同じ出来事が、世界のどこで、誰に、どう異なって受け止められているか。そのズレから構造変化を読む。",
    url: "https://magmawatch.vercel.app",
    siteName: "MagmaWatch",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "/og/magmawatch-og.png",
        width: 1200,
        height: 630,
        alt: "MagmaWatch preview card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MagmaWatch — Discourse Shift Observatory",
    description:
      "同じ出来事が、世界のどこで、誰に、どう異なって受け止められているか。そのズレから構造変化を読む。",
    images: ["/og/magmawatch-og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
