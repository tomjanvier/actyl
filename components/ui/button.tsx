import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-ink shadow-sm hover:bg-accent-hover",
        secondary:
          "bg-elev text-fg ring-1 ring-inset ring-line hover:bg-hoverstrong",
        outline:
          "border border-line bg-transparent text-mut hover:bg-elev hover:text-fg",
        ghost: "text-mut hover:bg-elev hover:text-fg",
        destructive:
          "bg-rose-600/90 text-white hover:bg-rose-500",
        link: "text-accent-text underline-offset-4 hover:text-accent hover:underline",
      },
      size: {
        default: "min-h-11 px-3.5 py-2 sm:min-h-9",
        sm: "min-h-11 px-3 py-2 text-xs sm:min-h-8 sm:py-1",
        lg: "min-h-11 px-5 py-2",
        icon: "size-11 sm:size-8",
        "icon-sm": "size-11 rounded-md sm:size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { Button, buttonVariants };
