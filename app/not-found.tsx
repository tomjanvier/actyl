import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[42px] font-semibold tracking-tight text-fg">404</p>
      <h1 className="text-[16px] font-semibold text-fg">Page introuvable</h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-mut">
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/contacts"
        className="mt-2 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-indigo-500"
      >
        Retour à l&apos;espace de travail
      </Link>
    </div>
  );
}
