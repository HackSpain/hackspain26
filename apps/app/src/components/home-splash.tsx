"use client";

import type { CSSProperties } from "react";

import Image from "next/image";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { EditionDates } from "@/components/edition-label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = [0.23, 1, 0.32, 1] as const;

const mosaic = {
  hidden: {},
  show: {
    transition: { delayChildren: 0.06, staggerChildren: 0.038 },
  },
};

const scaleTile = {
  hidden: { opacity: 0, scaleY: 0 },
  show: {
    opacity: 1,
    scaleY: 1,
    transition: { duration: 0.42, ease: EASE },
  },
};

const fadeTile = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
};

const copy = {
  hidden: {},
  show: {
    transition: { delayChildren: 0.38, staggerChildren: 0.09 },
  },
};

const copyItem = {
  hidden: { filter: "blur(4px)", opacity: 0, y: 12 },
  show: {
    filter: "blur(0px)",
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE },
  },
};

const copyItemReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.16 } },
};

const rule = {
  hidden: { opacity: 0, scaleX: 0 },
  show: {
    opacity: 1,
    scaleX: 1,
    transition: { duration: 0.5, ease: EASE },
  },
};

type TileSpec = {
  area: string;
  clip?: string;
  origin: "top" | "bottom";
  tone: string;
};

const TILES: readonly TileSpec[] = [
  {
    area: "a",
    clip: "[clip-path:polygon(0_0,100%_0,0_100%)]",
    origin: "top",
    tone: "bg-hs-orange",
  },
  { area: "b", origin: "top", tone: "bg-hs-paper" },
  { area: "c", origin: "top", tone: "bg-hs-gold" },
  { area: "d", origin: "top", tone: "bg-hs-paper" },
  { area: "e", origin: "top", tone: "bg-hs-teal" },
  {
    area: "f",
    clip: "[clip-path:polygon(100%_0,100%_100%,0_0)]",
    origin: "top",
    tone: "bg-hs-red",
  },
  { area: "g", origin: "bottom", tone: "bg-hs-navy" },
  { area: "h", origin: "top", tone: "bg-hs-gold" },
  { area: "i", origin: "bottom", tone: "bg-hs-orange" },
  { area: "j", origin: "top", tone: "bg-hs-teal" },
  { area: "k", origin: "bottom", tone: "bg-hs-red" },
  { area: "l", origin: "top", tone: "bg-hs-sand" },
  { area: "m", origin: "bottom", tone: "bg-hs-gold" },
  { area: "n", origin: "bottom", tone: "bg-hs-paper" },
  { area: "o", origin: "bottom", tone: "bg-hs-teal" },
  { area: "p", origin: "bottom", tone: "bg-hs-orange" },
  { area: "q", origin: "bottom", tone: "bg-hs-paper" },
  { area: "r", origin: "bottom", tone: "bg-hs-red" },
];

function Tile({
  area,
  clip,
  origin,
  reduced,
  tone,
}: TileSpec & { reduced: boolean }) {
  return (
    <motion.div
      className={cn(
        "grid-area-var min-h-0 min-w-0",
        origin === "bottom" ? "origin-bottom" : "origin-top",
        tone,
        clip
      )}
      style={{ "--grid-area": area } as CSSProperties}
      variants={reduced ? fadeTile : scaleTile}
    />
  );
}

export function HomeSplash() {
  const reduced = useReducedMotion() ?? false;
  const item = reduced ? copyItemReduced : copyItem;

  return (
    <div className="h-dvh overflow-hidden bg-hs-ink text-hs-ink">
      <div className="hs-splash-mosaic grid h-full w-full gap-stroke p-stroke">
        <motion.div
          aria-hidden
          className="contents"
          initial="hidden"
          animate="show"
          variants={mosaic}
        >
          {TILES.map((tile) => (
            <Tile key={tile.area} reduced={reduced} {...tile} />
          ))}
        </motion.div>
        <div className="col-span-4 col-start-2 row-span-3 row-start-2 flex min-h-0 min-w-0 flex-col items-center justify-center bg-hs-paper px-6 py-8 sm:px-10">
          <motion.div
            className="flex w-full max-w-sm flex-col items-center"
            initial="hidden"
            animate="show"
            variants={copy}
          >
            <motion.h1 className="m-0" variants={item}>
              <Image
                src="/logo.svg"
                alt="HackSpain"
                width={250}
                height={82}
                className="h-auto w-52 sm:w-64 md:w-72"
              />
            </motion.h1>
            <motion.div
              aria-hidden
              className="mt-6 h-stroke w-16 origin-center bg-hs-gold"
              variants={reduced ? item : rule}
            />
            <motion.div className="mt-5 text-center sm:text-sm" variants={item}>
              <EditionDates className="text-pretty sm:text-sm" />
            </motion.div>
            <motion.div className="mt-8 w-full max-w-56" variants={item}>
              <Button asChild className="w-full">
                <Link href="/login">Entrar</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
