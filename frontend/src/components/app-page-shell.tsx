import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppPageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AppPageShell({ children, className, contentClassName }: AppPageShellProps) {
  return (
    <div className={cn("flex-1 p-8", className)}>
      <div className={cn("mx-auto w-full", contentClassName)}>{children}</div>
    </div>
  );
}
