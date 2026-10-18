import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apostas do Dia",
  description: "Recomendações diárias de apostas de futebol: modelo de valor, tipsters e IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <a href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-xl" aria-hidden>⚽</span> Apostas do Dia
            </a>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-faint">
          Recomendações estatísticas, não garantias. Aposte apenas o que pode perder. +18 · Se o jogo deixar de ser diversão, procure ajuda.
        </footer>
      </body>
    </html>
  );
}
