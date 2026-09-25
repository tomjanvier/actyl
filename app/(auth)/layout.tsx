import Link from "next/link";
import { ActylLogo } from "@/components/layout/actyl-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" aria-label="Accueil Actyl" className="mb-8">
        <ActylLogo className="h-10 w-[158px]" priority />
      </Link>
      {children}
      <p className="mt-8 max-w-sm text-center text-[12px] leading-relaxed text-faint">
        CRM de plaidoyer open-source — organisez vos campagnes de lobbying,
        suivez les décideurs et mobilisez vos soutiens.
      </p>
    </div>
  );
}
