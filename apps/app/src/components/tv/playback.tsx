"use client";

import { Component } from "react";
import type { ReactNode } from "react";

export class PlaybackBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="flex min-h-dvh items-center justify-center bg-hs-ink text-hs-gold">
        <p className="font-bungee text-4xl">HackSpain · Volvemos enseguida</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
