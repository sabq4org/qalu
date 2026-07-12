import Link from "next/link";

const LINKS = [
  { href: "/search", label: "بحث" },
  { href: "/ask", label: "اسأل" },
  { href: "/promises", label: "وعود" },
  { href: "/digest", label: "مساءلة" },
  { href: "/play", label: "من قال؟" },
  { href: "/embed", label: "ويدجت" },
];

export default function SiteNav() {
  return (
    <nav className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm justify-center sm:justify-start">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="text-muted hover:text-accent">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
