import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Actyl", template: "%s · Actyl" },
  description:
    "CRM de plaidoyer open-source : campagnes de lobbying, suivi des décideurs et mobilisation citoyenne.",
  applicationName: "Actyl",
};

const themeScript = `(function(){try{var t=localStorage.getItem("actyl_theme");if(t==="light"){document.documentElement.classList.remove("dark")}else{document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
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
