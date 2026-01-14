// src/components/DbResumeGuard.tsx
import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as SQLite from "expo-sqlite";
import { initDb, pingDb } from "@/db"; // from db/index.ts

export function DbResumeGuard({ children }: { children: React.ReactNode }) {
  const db = SQLite.useSQLiteContext();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const ensure = async () => {
      try {
        await pingDb(db);
      } catch (e) {
        // If ping fails, run initDb again. This won't wipe unless schema version changed.
        console.warn("⚠️ DB ping failed on resume; re-initializing.", (e as any)?.message ?? e);
        await initDb(db);
      }
    };

    // mount
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
