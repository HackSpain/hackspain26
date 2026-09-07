"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { SignOutButton } from "@/components/auth-gate";
import { AuthScreen } from "@/components/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UnregisteredPage() {
  const me = useQuery(api.users.me);

  return (
    <AuthScreen>
      <Card className="hs-enter w-full max-w-lg">
        <CardHeader>
          <p className="font-bungee text-xs text-hs-brown">HackSpain 2026</p>
          <CardTitle className="text-2xl sm:text-3xl">
            No hay solicitud
          </CardTitle>
          <CardDescription>
            No tenemos una inscripción de HackSpain para{" "}
            {me?.email ?? "este email"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-hs-brown">
          <p>
            Entra con el mismo email que usaste en hackspain.com/signup. Este
            panel es solo para quien ya se ha apuntado. Si falta tu solicitud,
            pide a la organización que la importe.
          </p>
          <SignOutButton className="w-full sm:w-auto" />
        </CardContent>
      </Card>
    </AuthScreen>
  );
}
