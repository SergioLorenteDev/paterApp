import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaterApp",
  description: "Aplicacion web de operaciones de postventa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem("theme");
                  var theme = stored === "dark" || stored === "light"
                    ? stored
                    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.setAttribute("data-theme", theme);
                } catch (_) {}
              })();
            `,
          }}
        />
        <a className="skip-link" href="#contenido-principal">
          Saltar al contenido principal
        </a>
        <div className="app-shell">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="brand">
                <strong>PaterApp</strong>
                <span>Postventa industrial</span>
              </div>
              <div className="topbar-actions">
                <Link className="nav-link" href="/">
                  Inicio
                </Link>
                <Link className="nav-link" href="/activos">
                  Activos
                </Link>
                <Link className="nav-link" href="/casos">
                  Casos
                </Link>
                <Link className="nav-link" href="/kpis">
                  KPIs
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div id="contenido-principal">{children}</div>
        </div>
      </body>
    </html>
  );
}
