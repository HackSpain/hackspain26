"use client";

import { createContext, useContext } from "react";

/**
 * Curtain shown from the moment a login code is accepted until the page the
 * user lands on has mounted. Without it the gate flips through "Cargando…",
 * remounts the login card for a frame and only then reaches the dashboard.
 *
 * The auth gate owns the lifecycle (it knows when the destination is
 * rendered); the login page only calls the context function to begin.
 */
const LoginTransitionContext = createContext<(email: string | null) => void>(
  () => {
    // No gate above (a page rendered outside it): nothing to cover.
  }
);

export const LoginTransitionProvider = LoginTransitionContext.Provider;

export function useBeginLoginTransition() {
  return useContext(LoginTransitionContext);
}
