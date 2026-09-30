import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { PUBLIC_APP_PATHS } from "@/lib/public-paths";

// /api/cli/* authenticates with a bearer token, not the cookie session.
// /api/files/* accepts either and does its own redirect, so image links from
// the CLI work in a browser.
// / is the unauthenticated splash. /tv is the public venue screen.
// /final/cancelar is a token-gated cancel page for finalists; no login.
// /cli-auth is public at the middleware level. Current #hs-code= links keep
// the code in the browser; legacy ?hs-code= links must avoid a server-side
// redirect. AuthGate stashes either form and routes visitors via /login.
// /cli-auth/handoff signs the browser in from a CLI session, so it must be
// reachable without one.
const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/cli-auth(.*)",
  "/api/login/otp",
  "/api/cli(.*)",
  "/api/files(.*)",
  "/api/tv",
  "/api/tv/insights",
  "/api/cierre(.*)",
  "/betterstack(.*)",
  ...PUBLIC_APP_PATHS,
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (!isPublicRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
