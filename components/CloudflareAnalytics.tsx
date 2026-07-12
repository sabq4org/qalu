import Script from "next/script";

/** Cloudflare Web Analytics — بلا كوكيز. يُفعَّل عبر NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN */
export default function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN;
  if (!token) return null;

  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
      strategy="afterInteractive"
    />
  );
}
