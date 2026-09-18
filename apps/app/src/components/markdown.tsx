import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

function safeUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  const value = url.trim();
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  if (/^(https?:|mailto:)/i.test(value)) {
    return value;
  }
  return undefined;
}

const components: Components = {
  h1: ({ children }) => (
    <h2 className="font-bungee text-2xl leading-tight text-balance">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="font-bungee text-xl leading-tight text-balance">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-bungee text-base leading-snug text-balance">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="font-semibold leading-snug text-balance">{children}</h5>
  ),
  p: ({ children }) => <p className="text-pretty leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 text-pretty">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 text-pretty">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => {
    const url = safeUrl(href);
    if (!url) {
      return <span>{children}</span>;
    }
    const external = /^https?:/i.test(url);
    return (
      <a
        href={url}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className="font-medium text-hs-navy underline decoration-hs-navy/40 underline-offset-4 outline-none hover:decoration-hs-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hs-navy"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-hs-ink/30 pl-3 text-hs-brown">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-hs-ink/20" />,
  pre: ({ children }) => (
    <pre className="overflow-x-auto border-[3px] border-hs-ink bg-hs-sand/50 p-3 font-mono text-sm leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="bg-hs-sand/80 px-1 py-0.5 font-mono text-[0.9em] [pre_&]:bg-transparent [pre_&]:p-0">
      {children}
    </code>
  ),
  img: ({ src, alt }) => {
    const url = safeUrl(typeof src === "string" ? src : undefined);
    if (!url) {
      return null;
    }
    return (
      // Challenge assets are remote or under /public; keep them out of next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt ?? ""}
        className="max-w-full outline outline-1 outline-black/10"
      />
    );
  },
};

export function TrackMarkdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 text-base text-hs-ink", className)}>
      <Markdown components={components}>{source}</Markdown>
    </div>
  );
}
