// src/components/DbResumeGuard.tsx
import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { ensureDbReady } from "@/db";

export function DbResumeGuard({ children }: { children: React.ReactNode }) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // single-flight promise
  const ensuring = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const ensure = async () => {
      if (ensuring.current) return ensuring.current;

      ensuring.current = (async () => {
        try {
          await ensureDbReady();
        } finally {
          ensuring.current = null;
        }
      })();

      return ensuring.current;
    };

    ensure().catch((e) => console.error("DB ensure on mount failed:", e));

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;

      if ((prev === "background" || prev === "inactive") && next === "active") {
        ensure().catch((e) => console.error("DB ensure on resume failed:", e));
      }
    });

    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
