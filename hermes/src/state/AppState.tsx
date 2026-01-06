import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PracticeItem } from '../../shared/domain/practice';

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

export type LanguageProfile = {
    id: string;
    name: string;
    code: string;
    createdAt: number;
};


type AppState = {
    languages: LanguageProfile[];
    activeLanguageId: string | null;

    session: UISession | null;

    addLanguage: (lang: { name: string; code: string }) => Promise<void>;
    setActiveLanguage: (id: string | null) => Promise<void>;

    startSession: (type:SessionType) => void;
    advancePractice: () => void;
    endSession: () => void;
};

const STORAGE = {
    languages: "hermes.languages",
    activeLanguageId: "hermes.activeLangaugeId",
};

const Ctx = createContext<AppState | null>(null);

function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
    const [languages, setLanguages] = useState<LanguageProfile[]>([]);
    const [activeLanguageId, setActiveLanguageId] = useState<string | null>(null);
    const [session, setSession] = useState<UISession | null>(null);

    useEffect(() => {
        (async () => {
            const [langsRaw, activeRaw] = await Promise.all([
                AsyncStorage.getItem(STORAGE.languages),
                AsyncStorage.getItem(STORAGE.activeLanguageId),
            ]);

            if (langsRaw) setLanguages(JSON.parse(langsRaw));
            if (activeRaw) setActiveLanguageId(activeRaw);
        })();
    }, []);

    useEffect(() => {
        AsyncStorage.setItem(STORAGE.languages, JSON.stringify(languages));
    }, [languages]);

    const addLanguage: AppState['addLanguage'] = async ({ name, code }) => {
        const newLang: LanguageProfile = {
            id: uid(),
            name,
            code,
            createdAt: Date.now(),
        }; 
        const next = [...languages, newLang];
        setLanguages(next);

        if (!activeLanguageId) {
            await setActiveLanguage(newLang.id); 
        }
    };

    const setActiveLanguage: AppState["setActiveLanguage"] = async (id) => {
        setActiveLanguageId(id);
        if (id) await AsyncStorage.setItem(STORAGE.activeLanguageId, id);
        else await AsyncStorage.removeItem(STORAGE.activeLanguageId);   
    };

    const startSession: AppState["startSession"] = (type) => {
        if (!activeLanguageId) return;

        //TODO call servcies to assembe real queues
        const conceptIds = ['concept1', 'concept2', 'concept3']; // Initialize as an array
        const practiceItemIds = ['item1', 'item2', 'item3'];

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
            languages,
            activeLanguageId,
            session,
            addLanguage,
            setActiveLanguage,
            startSession,
            advancePractice,
            endSession,
        }),
        [languages, activeLanguageId, session]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
    const v = useContext(Ctx);
    if (!v) throw new Error("useAppState must be used within AppStateProvider");
    return v;     
}