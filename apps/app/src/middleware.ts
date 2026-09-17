import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// BotID challenge/proxy paths have no file extension, so the matcher below
// would otherwise send them to /login and classification would fail.
const BOTID_PREFIX =
  "/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3";

// /api/cli/* authenticates with a bearer token, not the cookie session.
// /api/files/* accepts either and does its own redirect, so image links from
// the CLI work in a browser.
// / is the unauthenticated splash. /tv is the public venue screen.
// /cli-auth is public at the middleware level so ?hs-code= survives a
// server-side redirect; AuthGate stashes it and routes visitors via /login.
// /cli-auth/handoff signs the browser in from a CLI session, so it must be
// reachable without one.
// /github/callback relays GitHub's public callback to the Convex HTTP action.
const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/github/callback",
  "/cli-auth(.*)",
  "/api/login/otp",
  "/api/cli(.*)",
  "/api/files(.*)",
  "/tv",
  "/api/tv",
  "/betterstack(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (new URL(request.url).pathname.startsWith(BOTID_PREFIX)) {
    return undefined;
  }
  const authenticated = await convexAuth.isAuthenticated();
  if (!isPublicRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  return undefined;
}, {
  // This code belongs to GitHub account linking, not a Convex Auth sign-in.
  shouldHandleCode: (request) => request.nextUrl.pathname !== "/github/callback",
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
