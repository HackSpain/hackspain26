import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CONVEX_CLOUD_SUFFIX = ".convex.cloud";
const CONVEX_SITE_SUFFIX = ".convex.site";

function parseOrigin(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Convex site URL must use HTTP or HTTPS");
  }
  return url;
}

function convexSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
  if (configured) {
    return parseOrigin(configured).origin;
  }

  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!deploymentUrl) {
    throw new Error("Convex is not configured");
  }

  const url = parseOrigin(deploymentUrl);
  if (!url.hostname.endsWith(CONVEX_CLOUD_SUFFIX)) {
    throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required for this deployment");
  }
  url.hostname = `${url.hostname.slice(0, -CONVEX_CLOUD_SUFFIX.length)}${CONVEX_SITE_SUFFIX}`;
  return url.origin;
}

function failedCallback(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/?github=error", request.url), 302);
}

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url);
    const upstream = new URL("/github/callback", convexSiteOrigin());
    upstream.search = incoming.search;

    const response = await fetch(upstream, {
      cache: "no-store",
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      return NextResponse.redirect(location, 302);
    }

    console.warn(`[github] Convex callback returned ${response.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[github] Callback relay failed: ${message}`);
  }

  return failedCallback(request);
}
