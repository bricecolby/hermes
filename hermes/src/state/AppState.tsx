import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SessionType = "learn" | "review";

export type UISession = {
  id: string;
  type: SessionType;

  languageId: string;

  conceptIds: string[];
  practiceItemIds: string[];
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

    // TODO: replace with real queue assembly from DB / services
    const conceptIds = ["concept1", "concept2", "concept3"];
    const practiceItemIds = ["item1", "item2", "item3"];

    setSession({
      id: uid(),
      type,
      languageId: activeLanguageId,
      conceptIds,
      practiceItemIds,
      practiceIndex: 0,
      startedAt: Date.now(),
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
