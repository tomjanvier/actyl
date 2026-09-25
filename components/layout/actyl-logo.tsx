import Image from "next/image";
import { cn } from "@/lib/utils";

export function ActylLogo({
  variant = "lockup",
  className,
  priority = false,
}: {
  variant?: "lockup" | "icon";
  className?: string;
  priority?: boolean;
}) {
  const isLockup = variant === "lockup";
  const width = isLockup ? 652 : 256;
  const height = isLockup ? 200 : 256;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Image
        src={isLockup ? "/brand/actyl-clair-logo.svg" : "/brand/actyl-clair-icone.svg"}
        alt="Actyl"
        width={width}
        height={height}
        priority={priority}
        sizes={isLockup ? "180px" : "48px"}
        className="block h-auto w-full dark:hidden"
      />
      <Image
        src={isLockup ? "/brand/actyl-sombre-logo.svg" : "/brand/actyl-sombre-icone.svg"}
        alt=""
        width={width}
        height={height}
        priority={priority}
        sizes={isLockup ? "180px" : "48px"}
        className="hidden h-auto w-full dark:block"
      />
    </span>
  );
}
