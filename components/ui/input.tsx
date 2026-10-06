import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 sm:h-9 rounded-lg border border-line bg-elev px-3 py-1 text-base text-fg sm:text-[13px] transition-[border-color,box-shadow,background-color] placeholder:text-faint hover:border-hoverstrong focus-visible:border-accent focus-visible:bg-card focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-line bg-elev px-3 py-2 text-base leading-relaxed sm:text-[13px] text-fg transition-[border-color,box-shadow,background-color] placeholder:text-faint hover:border-hoverstrong focus-visible:border-accent focus-visible:bg-card focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
