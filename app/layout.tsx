import CloudflareAnalytics from "@/components/CloudflareAnalytics";
import HeaderSearch from "@/components/HeaderSearch";
import SiteNav from "@/components/SiteNav";
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
  },
  twitter: {
    card: "summary_large_image",
    title: "ماذا قالوا؟ — القول الفصل في التصريحات",
    description: SITE_DESCRIPTION,
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
        <CloudflareAnalytics />
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
            <Link href="/" aria-label="ماذا قالوا — الرئيسية" className="shrink-0">
              <BrandMark size={34} />
            </Link>
            <HeaderSearch />
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-5 sm:py-8">{children}</main>
        <footer className="border-t border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-6 space-y-3">
            <SiteNav />
            <div className="text-sm text-muted">
              © {new Date().getFullYear()} ماذا قالوا؟ — نرصد ما قيل، متى قيل، وممّن قيل، بدقة
              وبلا تهويل.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
