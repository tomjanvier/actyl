import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-line bg-elev px-3 py-1 text-[13px] text-fg shadow-sm transition-colors placeholder:text-faint focus-visible:border-indigo-500/60 focus-visible:bg-elev focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
        "flex min-h-[80px] w-full rounded-lg border border-line bg-elev px-3 py-2 text-[13px] leading-relaxed text-fg shadow-sm transition-colors placeholder:text-faint focus-visible:border-indigo-500/60 focus-visible:bg-elev focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
