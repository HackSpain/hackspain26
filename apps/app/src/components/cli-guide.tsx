"use client";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CodeBlock } from "@/components/team-cli-dialog";

export function CliGuideSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>CLI de hackspain</SheetTitle>
          <SheetDescription>
            Misma cuenta que este dashboard. Instala, inicia sesión y gestiona
            el equipo, los retos y el feed.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div className="space-y-2">
            <p className="font-bungee text-xs">Instala e inicia sesión</p>
            <CodeBlock>
              {
                "curl -fsSL https://hackspain.com/install.sh | sh\nhackspain auth login"
              }
            </CodeBlock>
          </div>
          <div className="space-y-2">
            <p className="font-bungee text-xs">Equipo y retos</p>
            <CodeBlock>
              {
                "hackspain team create <nombre>\nhackspain team join <código>\nhackspain track register <slug>\nhackspain submit"
              }
            </CodeBlock>
          </div>
          <div className="space-y-2">
            <p className="font-bungee text-xs">Feed</p>
            <CodeBlock>{'hackspain feed\nhackspain post "mensaje"'}</CodeBlock>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
