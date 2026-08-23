import { Landmark } from "lucide-react";
import Link from "next/link";
import { PlaidActCredit } from "@/components/layout/plaidact-credit";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-fg transition-colors hover:text-white"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600/20 ring-1 ring-inset ring-indigo-500/30">
          <Landmark className="size-4.5 text-indigo-700 dark:text-indigo-400" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          AdvocacyHQ
        </span>
      </Link>
      {children}
      <p className="mt-8 max-w-sm text-center text-[12px] leading-relaxed text-faint">
        CRM de plaidoyer open-source — organisez vos campagnes de lobbying,
        suivez les décideurs et mobilisez vos soutiens.
      </p>
    </div>
  );
}
