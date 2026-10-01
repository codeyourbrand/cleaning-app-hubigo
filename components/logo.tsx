import Image from "next/image";
import { cn } from "@/lib/utils";

export function HubigoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Hubigo"
      width={96}
      height={96}
      priority
      className={cn("size-9 shrink-0 rounded-xl object-cover", className)}
    />
  );
}

export function HubigoLogo({
  className,
  markClassName,
  wordClassName,
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <HubigoMark className={markClassName} />
      <span className={cn("text-xl font-bold tracking-tight", wordClassName)}>
        hubigo
      </span>
    </span>
  );
}
