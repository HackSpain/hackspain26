import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { githubRedirectUri } from "./github";

const http = httpRouter();
auth.addHttpRoutes(http);

type GithubStatus = "linked" | "cancelled" | "expired" | "taken" | "error";

/** Back to the dashboard with `?github=<status>`, on the page that started the link when it said so. */
function backToApp(status: GithubStatus, returnTo?: string): Response {
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const url = new URL(returnTo ?? "/", `${site}/`);
  url.searchParams.set("github", status);
  return Response.redirect(url.toString(), 302);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function exchangeCode(code: string): Promise<string | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  const response = await fetch("https://github.com/login/oauth/access_token", {
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: githubRedirectUri(),
    }),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  return isRecord(data) && typeof data.access_token === "string"
    ? data.access_token
    : null;
}

async function fetchGithubUser(
  token: string
): Promise<{ id: string; login: string; avatarUrl?: string } | null> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "hackspain-dashboard",
    },
  });
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || typeof data.login !== "string") {
    return null;
  }
  const id =
    typeof data.id === "number" || typeof data.id === "string"
      ? String(data.id)
      : null;
  if (!id) {
    return null;
  }
  return {
    avatarUrl:
      typeof data.avatar_url === "string" ? data.avatar_url : undefined,
    id,
    login: data.login,
  };
}

http.route({
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state) {
      return backToApp("error");
    }

    const consumed = await ctx.runMutation(internal.github.consumeState, {
      state,
    });
    if (!consumed) {
      return backToApp("expired");
    }
    const { returnTo, userId } = consumed;
    if (url.searchParams.get("error") || !code) {
      return backToApp("cancelled", returnTo);
    }

    const token = await exchangeCode(code);
    if (!token) {
      return backToApp("error", returnTo);
    }
    const profile = await fetchGithubUser(token);
    if (!profile) {
      return backToApp("error", returnTo);
    }

    try {
      await ctx.runMutation(internal.github.linkAccount, {
        accessToken: token,
        avatarUrl: profile.avatarUrl,
        githubId: profile.id,
        login: profile.login,
        userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return backToApp(
        message.includes("otro usuario") ? "taken" : "error",
        returnTo
      );
    }
    return backToApp("linked", returnTo);
  }),
  method: "GET",
  path: "/github/callback",
});

export default http;
