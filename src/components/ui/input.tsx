import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-slate-400 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
        className,
      )}
      {...props}
    />
  );
}
