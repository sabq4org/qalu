import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  weight: ["400", "600", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: true,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const SITE_DESCRIPTION =
  "أرشيف موثق لتصريحات الشخصيات العامة العربية — نرصد ما قيل، متى قيل، وممّن قيل. كل تصريح بنصه الحرفي ومصدره الصحفي وتاريخه.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ماذا قالوا؟ — القول الفصل في التصريحات",
    template: "%s | ماذا قالوا؟",
  },
  description: SITE_DESCRIPTION,
  applicationName: "ماذا قالوا؟",
  openGraph: {
    siteName: "ماذا قالوا؟",
    locale: "ar_SA",
    type: "website",
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ماذا قالوا؟ — القول الفصل في التصريحات",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ماذا قالوا؟ — القول الفصل في التصريحات",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plexArabic.variable}>
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <Link href="/" aria-label="ماذا قالوا — الرئيسية">
              <BrandMark size={38} />
            </Link>
            <p className="text-sm text-muted hidden sm:block">
              القول الفصل في التصريحات
            </p>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted">
            © {new Date().getFullYear()} ماذا قالوا؟ — نرصد ما قيل، متى قيل، وممّن قيل، بدقة
            وبلا تهويل.
          </div>
        </footer>
      </body>
    </html>
  );
}
