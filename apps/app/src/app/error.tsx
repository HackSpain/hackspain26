"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hs-paper px-4">
      <Card className="hs-enter w-full max-w-md">
        <CardHeader>
          <CardTitle>Algo ha fallado</CardTitle>
          <CardDescription>
            {error.message || "Ha ocurrido un error inesperado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" onClick={() => reset()}>
            Reintentar
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
