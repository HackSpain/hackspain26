import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { githubRedirectUri } from "./lib/github";
import { isCodedError } from "./lib/errors";
import { isRecord } from "./lib/isRecord";

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

const LANDING_SECRET_HEADER = "x-hackspain-secret";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function landingErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && isCodedError(error.data)) {
    return error.data.message;
  }
  return error instanceof Error ? error.message : "error";
}

function landingError(error: unknown): Response {
  const message = landingErrorMessage(error);
  if (message === "Unauthorized") {
    return json({ error: "unauthorized" }, 401);
  }
  if (message === "invalid_json") {
    return json({ error: "invalid_json" }, 400);
  }
  if (message.includes("Email inválido") || message.includes("nombre")) {
    return json({ error: "invalid_email" }, 400);
  }
  if (message.includes("Rol desconocido") || message.includes("no admite")) {
    return json({ error: "unknown_role" }, 400);
  }
  if (message.includes("Ya hay una solicitud")) {
    return json({ error: "duplicate_email" }, 409);
  }
  if (message.includes("inscripciones están cerradas")) {
    return json({ error: "closed" }, 410);
  }
  if (message.includes("Foto")) {
    return json({ error: "invalid_photo" }, 400);
  }
  if (message.includes("No encontrado")) {
    return json({ error: "not_found" }, 404);
  }
  return json({ error: "save_failed" }, 500);
}

function landingSecret(request: Request): string {
  return request.headers.get(LANDING_SECRET_HEADER) ?? "";
}

function queryToken(request: Request): string {
  return new URL(request.url).searchParams.get("token") ?? "";
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("invalid_json");
  }
  if (!isRecord(body)) {
    throw new Error("invalid_json");
  }
  return body;
}

function stringField(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function landingRoute(
  method: "GET" | "POST",
  path: string,
  handler: (ctx: ActionCtx, request: Request) => Promise<Response>
) {
  http.route({
    handler: httpAction(async (ctx, request) => {
      try {
        return await handler(ctx, request);
      } catch (error) {
        return landingError(error);
      }
    }),
    method,
    path,
  });
}

landingRoute("POST", "/landing/subscribe", async (ctx, request) => {
  const body = await readJson(request);
  const email = stringField(body, "email");
  if (!email) {
    throw new Error("Email inválido");
  }
  await ctx.runMutation(api.landing.subscribe, {
    email,
    secret: landingSecret(request),
  });
  return json({ ok: true });
});

landingRoute("POST", "/landing/apply", async (ctx, request) => {
  const body = await readJson(request);
  const email = stringField(body, "email");
  const fullName = stringField(body, "fullName");
  const roleSlug = stringField(body, "roleSlug");
  if (!(email && fullName && roleSlug)) {
    throw new Error("Email inválido");
  }
  await ctx.runMutation(api.landing.apply, {
    achievements: stringField(body, "achievements"),
    ambassadorMotivation: stringField(body, "ambassadorMotivation"),
    ambassadorStudyWhere: stringField(body, "ambassadorStudyWhere"),
    dietaryDetails: stringField(body, "dietaryDetails"),
    dietaryRestrictions: stringField(body, "dietaryRestrictions"),
    email,
    freeTime: stringField(body, "freeTime"),
    fullName,
    githubUrl: stringField(body, "githubUrl"),
    linkedinUrl: stringField(body, "linkedinUrl"),
    roleSlug,
    secret: landingSecret(request),
    wantsAmbassador: body.wantsAmbassador === true,
    webUrl: stringField(body, "webUrl"),
    xUrl: stringField(body, "xUrl"),
  });
  return json({ ok: true });
});

landingRoute("GET", "/landing/confirm", async (ctx, request) =>
  json(
    await ctx.runQuery(api.landing.lookupConfirmation, {
      secret: landingSecret(request),
      token: queryToken(request),
    })
  )
);

landingRoute("POST", "/landing/confirm", async (ctx, request) => {
  const body = await readJson(request);
  return json(
    await ctx.runMutation(api.landing.confirm, {
      secret: landingSecret(request),
      token: stringField(body, "token") ?? "",
    })
  );
});

landingRoute("GET", "/landing/cancel", async (ctx, request) =>
  json(
    await ctx.runQuery(api.landing.lookupCancellation, {
      secret: landingSecret(request),
      token: queryToken(request),
    })
  )
);

landingRoute("POST", "/landing/cancel", async (ctx, request) => {
  const body = await readJson(request);
  return json(
    await ctx.runMutation(api.landing.cancel, {
      secret: landingSecret(request),
      token: stringField(body, "token") ?? "",
    })
  );
});

landingRoute("POST", "/landing/cancel/request", async (ctx, request) => {
  const body = await readJson(request);
  await ctx.runMutation(api.landing.requestCancellation, {
    email: stringField(body, "email") ?? "",
    secret: landingSecret(request),
  });
  return json({ ok: true });
});

landingRoute("POST", "/landing/badge-photo", async (ctx, request) => {
  const body = await readJson(request);
  return json(
    await ctx.runMutation(api.landing.saveBadgePhoto, {
      photo: stringField(body, "photo") ?? "",
      secret: landingSecret(request),
      token: stringField(body, "token") ?? "",
    })
  );
});

landingRoute("GET", "/landing/share", async (ctx, request) => {
  const url = new URL(request.url);
  return json(
    await ctx.runQuery(api.landing.findSharedBadge, {
      fullName: url.searchParams.get("name") ?? "",
      githubHandle: url.searchParams.get("github") ?? undefined,
      secret: landingSecret(request),
    })
  );
});

export default http;
