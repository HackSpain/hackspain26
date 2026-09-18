import { Fragment } from "react";
import { linkParts } from "@/lib/perks";

export function LinkedText({ text }: { text: string }) {
  return linkParts(text).map((part, index) =>
    part.href ? (
      <a
        key={`${part.href}-${index}`}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px] hover:decoration-hs-navy"
      >
        {part.text}
      </a>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}
