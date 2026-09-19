import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The wizard footer: "Atrás" on the left when there is a step to return to,
 * the step's primary button (`children`) on the right.
 */
export function StepNav({
  onBack,
  disabled = false,
  children,
}: {
  onBack?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {onBack ? (
        <Button type="button" variant="outline" disabled={disabled} onClick={onBack}>
          <ArrowLeft aria-hidden />
          Atrás
        </Button>
      ) : (
        <span aria-hidden />
      )}
      {children}
    </div>
  );
}
