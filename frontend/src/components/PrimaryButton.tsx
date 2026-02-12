import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="default"
      size="default"
      className={cn("rounded-lg font-semibold", className)}
      {...props}
    />
  );
}
