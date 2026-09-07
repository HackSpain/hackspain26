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

export default function PendingPage() {
  const me = useQuery(api.users.me);

  return (
    <AuthScreen>
      <Card className="hs-enter w-full max-w-lg">
        <CardHeader>
          <p className="font-bungee text-xs text-hs-brown">HackSpain 2026</p>
          <CardTitle className="text-2xl sm:text-3xl">
            Aún no estás aceptado
          </CardTitle>
          <CardDescription>
            Tenemos una solicitud de {me?.email ?? "este email"}, pero no estás
            en la lista de aceptados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-hs-brown">
          <p>
            La organización marca a los hackers aceptados en el panel. Cuando te
            acepten, entra otra vez y confirma tus datos.
          </p>
          <SignOutButton className="w-full sm:w-auto" />
        </CardContent>
      </Card>
    </AuthScreen>
  );
}
