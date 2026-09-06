import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// /api/cli/* authenticates with a bearer token, not the cookie session.
// /api/files/* accepts either and does its own redirect, so image links from
// the CLI work in a browser.
// /tv is the public venue screen: no login, reads a public Convex query.
// /cli-auth is public at the middleware level so ?hs-code= survives a
// server-side redirect; AuthGate stashes it and routes visitors via /login.
const isPublicRoute = createRouteMatcher([
  "/login",
  "/cli-auth",
  "/api/login-check",
  "/api/cli(.*)",
  "/api/files(.*)",
  "/tv",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (!isPublicRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  return undefined;
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
