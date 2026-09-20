import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cancelar plaza de la final — HackSpain",
  robots: { index: false, follow: false },
};

export default function FinalCancelLayout({ children }: { children: ReactNode }) {
  return children;
}
