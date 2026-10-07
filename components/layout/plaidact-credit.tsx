export function PlaidActCredit({ className }: { className?: string }) {
  return (
    <a
      href="https://plaidact.org"
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1 text-[12px] text-faint transition-colors hover:text-mut"
      }
    >
      by{" "}
      <span className="font-semibold tracking-wide">
        PLAID<span className="text-accent-text">·</span>ACT
      </span>
    </a>
  );
}
