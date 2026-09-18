import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { RECEPTION_PATH } from "@/lib/reception";

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
  "/api/reception",
  "/betterstack(.*)",
  RECEPTION_PATH,
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
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
