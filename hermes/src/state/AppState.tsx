import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SessionType = "learn" | "review";

export type ConceptRef = {
  conceptId: number;
  kind: string; // ✅ keep open-ended
  refId: number;
  title: string | null;
  description: string | null;
};

export type UISession = {
  id: string;
  type: SessionType;
  languageId: number;

  conceptIds: number[];

  // ✅ resolved concept metadata (hydrated in setup)
  conceptRefs: ConceptRef[];

  practiceItemIds: number[];
  practiceIndex: number;

  startedAt: number;
};

type AppState = {
  activeProfileId: number | null;
  activeLanguageId: string | null;

  session: UISession | null;

  setActiveProfile: (params: { profileId: number; learningLangId: number } | null) => Promise<void>;
  setActiveLanguage: (id: string | null) => Promise<void>;

  startSession: (type: SessionType) => void;

  hydrateSessionConceptRefs: (conceptRefs: ConceptRef[]) => void;

  advancePractice: () => void;
  endSession: () => void;
};

const STORAGE = {
  activeProfileId: "hermes.activeProfileId",
  activeLanguageId: "hermes.activeLanguageId",
};

const Ctx = createContext<AppState | null>(null);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeLanguageId, setActiveLanguageId] = useState<string | null>(null);
  const [session, setSession] = useState<UISession | null>(null);

  useEffect(() => {
    (async () => {
      const [profileRaw, langRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE.activeProfileId),
        AsyncStorage.getItem(STORAGE.activeLanguageId),
      ]);

      if (profileRaw) setActiveProfileId(Number(profileRaw));
      if (langRaw) setActiveLanguageId(langRaw);
    })();
  }, []);

  const setActiveProfile: AppState["setActiveProfile"] = async (params) => {
    if (!params) {
      setActiveProfileId(null);
      setActiveLanguageId(null);
      setSession(null);

      await Promise.all([
        AsyncStorage.removeItem(STORAGE.activeProfileId),
        AsyncStorage.removeItem(STORAGE.activeLanguageId),
      ]);
      return;
    }

    const nextProfileId = params.profileId;
    const nextLangId = String(params.learningLangId);

    setActiveProfileId(nextProfileId);
    setActiveLanguageId(nextLangId);

    await Promise.all([
      AsyncStorage.setItem(STORAGE.activeProfileId, String(nextProfileId)),
      AsyncStorage.setItem(STORAGE.activeLanguageId, nextLangId),
    ]);
  };

  const setActiveLanguage: AppState["setActiveLanguage"] = async (id) => {
    setActiveLanguageId(id);
    if (id) await AsyncStorage.setItem(STORAGE.activeLanguageId, id);
    else await AsyncStorage.removeItem(STORAGE.activeLanguageId);
  };

  const startSession: AppState["startSession"] = (type) => {
    if (!activeLanguageId) return;

    const languageId = Number(activeLanguageId);
    if (!Number.isFinite(languageId)) return;

    // TODO: replace with real selection/assembly
    const conceptIds = [1, 2, 3];
    const practiceItemIds = [1, 2, 3];

    setSession({
      id: uid(),
      type,
      languageId,
      conceptIds,
      conceptRefs: [], 
      practiceItemIds,
      practiceIndex: 0,
      startedAt: Date.now(),
    });
  };

  const hydrateSessionConceptRefs: AppState["hydrateSessionConceptRefs"] = (conceptRefs) => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, conceptRefs };
    });
  };

  const advancePractice = () => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, practiceIndex: prev.practiceIndex + 1 };
    });
  };

  const endSession = () => setSession(null);

  const value = useMemo<AppState>(
    () => ({
      activeProfileId,
      activeLanguageId,
      session,
      setActiveProfile,
      setActiveLanguage,
      startSession,
      hydrateSessionConceptRefs, 
      advancePractice,
      endSession,
    }),
    [activeProfileId, activeLanguageId, session]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}
