import type { Metadata } from "next";
import { DM_Sans, Montserrat } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const display = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Actyl", template: "%s · Actyl" },
  description:
    "Actyl, CRM de plaidoyer développé par l’association PLAID·ACT. Découvrez l’outil sur plaidact.org.",
  applicationName: "Actyl",
  icons: {
    icon: [
      { url: "/brand/actyl-clair-icone.svg", media: "(prefers-color-scheme: light)" },
      { url: "/brand/actyl-sombre-icone.svg", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/brand/actyl-clair-icone.svg",
  },
  manifest: "/manifest.webmanifest",
};

const themeScript = `(function(){try{var t=localStorage.getItem("actyl_theme");if(t==="dark"){document.documentElement.classList.add("dark")}else{document.documentElement.classList.remove("dark")}}catch(e){document.documentElement.classList.remove("dark")}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-fg antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-raised !text-fg !border !border-line",
            style: {
              background: "var(--raised)",
              border: "1px solid var(--line)",
              color: "var(--fg)",
            },
          }}
        />
      </body>
    </html>
  );
}
