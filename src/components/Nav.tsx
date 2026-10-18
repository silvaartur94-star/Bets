"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hoje" },
  { href: "/historico", label: "Histórico" },
  { href: "/tipsters", label: "Tipsters" },
  { href: "/definicoes", label: "Definições" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
