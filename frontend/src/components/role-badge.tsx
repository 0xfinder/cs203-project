import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: string | null | undefined;
  className?: string;
  unknownLabel?: string;
}

function formatRole(role: string | null | undefined, unknownLabel: string) {
  return role?.trim() ? role.toUpperCase() : unknownLabel;
}

export function RoleBadge({ role, className, unknownLabel = "UNKNOWN ROLE" }: RoleBadgeProps) {
  return (
    <Badge variant="secondary" className={cn("text-xs font-semibold", className)}>
      {formatRole(role, unknownLabel)}
    </Badge>
  );
}
