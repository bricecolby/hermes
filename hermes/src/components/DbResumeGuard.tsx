// src/components/DbResumeGuard.tsx
import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as SQLite from "expo-sqlite";
import { initDb, pingDb } from "@/db";

export function DbResumeGuard({ children }: { children: React.ReactNode }) {
  const db = SQLite.useSQLiteContext();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // 👇 single-flight promise
  const ensuring = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const ensure = async () => {
      // 👇 if one is in progress, await it
      if (ensuring.current) return ensuring.current;

      ensuring.current = (async () => {
        try {
          await pingDb(db);
        } catch (e) {
          console.warn(
            "⚠️ DB ping failed on resume; re-initializing.",
            (e as any)?.message ?? e
          );
          await initDb(db);
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
  }, [db]);

  return <>{children}</>;
}
