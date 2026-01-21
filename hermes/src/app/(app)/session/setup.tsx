import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Text, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, Sub, Muted, SectionTitle } from "../../../components/ui/Typography";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../../db/queries/users";
import { getRandomVocabConceptRefs } from "@/db/queries/concepts";

import { llmClient } from "shared/services/llm/client";
import { PracticeItemGenerator } from "shared/services/practiceGeneration/PracticeItemGenerator";
import { buildGenerationContext } from "shared/services/practiceGeneration/context/buildGenerationContext";
import { registerPracticeItemSpecs } from "shared/services/practiceGeneration/specs/registerPracticeItemSpecs";
import { startPracticeSession } from "@/db/queries/sessions";

import { View } from "tamagui";

const MVP_USERNAME = "default";

registerPracticeItemSpecs();

const STOP_WORDS = ["```", "\n```", "\n\n```", "</s>"];

export default function SessionSetup() {
  const router = useRouter();
  const db = useSQLiteContext();

  const {
    session,
    activeProfileId,
    activeLanguageId,
    hydrateSessionConceptIds,
    hydrateSessionConceptRefs,
    hydrateSessionPracticeBank,
    setSessionDbId,
  } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [llmReady, setLlmReady] = useState<boolean>(() => llmClient.isReady());
  const [initializingLlm, setInitializingLlm] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [hydratingConcepts, setHydratingConcepts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const initInFlightRef = useRef(false);
  const genInFlightRef = useRef(false);

  const [genStep, setGenStep] = useState<number | null>(null);
  const [genTotal, setGenTotal] = useState<number>(0);

  const loadProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
      setProfiles(rows);
    } finally {
      setLoadingProfiles(false);
    }
  }, [db]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  const hasVocab = (session?.conceptIds.length ?? 0) > 0;
  const hasBank = (session?.practiceBank?.length ?? 0) > 0;

  // --- Step 0: Initialize LLM ---
  useEffect(() => {
    let cancelled = false;

    async function initLlm() {
      if (!session || !activeLanguageId) return;
      if (llmReady) return;
      if (initInFlightRef.current) return;

      initInFlightRef.current = true;
      setInitializingLlm(true);
      setLlmError(null);

      try {
        await llmClient.ensureReady();
        if (!cancelled) setLlmReady(true);
      } catch (e: any) {
        if (!cancelled) {
          setLlmError(e?.message ?? String(e));
          setLlmReady(false);
        }
      } finally {
        initInFlightRef.current = false;
        if (!cancelled) setInitializingLlm(false);
      }
    }

    initLlm();

    return () => {
      cancelled = true;
    };
  }, [session?.id, activeLanguageId, llmReady]);


  // --- Step 1: pick 5 random concepts ---
  useEffect(() => {
    let cancelled = false;

    async function pickVocab() {
      if (!activeLanguageId || !session) return;
      if (session.conceptIds.length > 0) return;

      try {
        setHydratingConcepts(true);

        const refs = await getRandomVocabConceptRefs(db, activeLanguageId, 5);
        if (cancelled) return;

        const conceptIds = refs.map((r) => r.conceptId);

        hydrateSessionConceptIds(conceptIds);
        hydrateSessionConceptRefs(refs);

      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setHydratingConcepts(false);
      }
    }

    pickVocab();

    return () => {
      cancelled = true;
    };
  }, [
    db,
    activeLanguageId,
    session?.id,
    session?.conceptIds, 
    hydrateSessionConceptIds,
    hydrateSessionConceptRefs,
  ]);

  // --- Step 2: generate practice bank once vocab exists AND LLM is ready ---
  useEffect(() => {
    if (!session) return;

    const hasVocab = session.conceptIds.length > 0;
    const hasBank = (session.practiceBank?.length ?? 0) > 0;

    if (!hasVocab || hasBank) return;
    if (!llmReady) return;
    if (genInFlightRef.current) return;

    let cancelled = false;

    (async () => {
      genInFlightRef.current = true;
      setGenerating(true);
      setGenerationError(null);

      try {
        const userId = String(activeProfileId ?? "default");

        const ctx = await buildGenerationContext({
          userId,
          mode: "reception",
          skills: ["reading"],
          conceptIds: session.conceptIds,
        });

        const generator = new PracticeItemGenerator(
          llmClient.complete.bind(llmClient),
          STOP_WORDS
        );

        const types = ["mcq_v1.basic", "cloze_v1.free_fill"] as const;

        const total = 5;
        setGenTotal(total);
        setGenStep(0);

        const bank: any[] = [];

        const refs = session.conceptRefs ?? [];
        if (refs.length === 0) {
          setGenerationError("No conceptRefs available (missing vocab titles).");
          return;
        }

        for (let i = 0; i < total; i++) {
          const type = types[i % types.length];

          // pick focus word for this item
          const focusRef = refs[i % refs.length];
          const focusWord = (focusRef?.title ?? "").trim();
          const translation = (focusRef?.description ?? "").trim();

          // distractors: other vocab titles (same session)
          const distractors = refs
            .filter((r) => r.conceptId !== focusRef.conceptId)
            .map((r) => (r.title ?? "").trim())
            .filter((t) => t.length > 0)
            .slice(0, 6); 

          setGenStep(i + 1);
          console.log(
            `[GEN] starting item ${i + 1}/${total} (${type}) focus="${focusWord}"`
          );

          const start = Date.now();

          const res = await generator.generate(type, ctx, undefined, {
            debug: true,
            timeoutMs: 30_000,
            focus: {
              conceptId: focusRef.conceptId,
              target: focusWord,
              translation: translation || undefined,
              distractors,
            },
          });

          const dur = Date.now() - start;
          console.log(`[GEN] finished item ${i + 1}/${total} (${type}) in ${dur}ms`);

          if (cancelled) return;

          if (res.ok) {
            const stamped = {
              ...res.parsed,
              conceptIds: [focusRef.conceptId],
            };
            bank.push(stamped);
          } else {
            console.warn(`[GEN] ✗ failed ${type}`, res.error);
          }

        }

        if (cancelled) return;

        if (bank.length === 0) {
          setGenerationError("No practice items were generated. Check logs for failures.");
          return;
        }

        hydrateSessionPracticeBank(bank);

        if (!activeLanguageId || !activeProfileId) {
          console.warn("[setup] missing activeLanguageId/activeProfileId; cannot create practice session row");
        } else {
          startPracticeSession(db, {
            languageId: activeLanguageId,
            userId: activeProfileId,
            startedAtIso: new Date().toISOString(),
            modality: "practice",
            source: "session",
          })
            .then((newSessionId) => setSessionDbId(newSessionId))
            .catch((e) => console.error("[setup] startPracticeSession failed", e));
        }

      } catch (e: any) {
        if (!cancelled) setGenerationError(e?.message ?? String(e));
      } finally {
        genInFlightRef.current = false;
        if (!cancelled) setGenerating(false);
        setGenStep(null);
        setGenTotal(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    session?.id,
    session?.conceptIds, 
    session?.conceptRefs, 
    session?.practiceBank?.length,
    activeProfileId,
    llmReady,
    setSessionDbId,
  ]);

  const canStart =
    !!session &&
    !!activeLanguageId &&
    llmReady &&
    !initializingLlm &&
    !hydratingConcepts &&
    !generating &&
    (session?.practiceBank?.length ?? 0) > 0;

  const genProgressPct =
    genStep !== null && genTotal > 0
      ? Math.round((genStep / genTotal) * 100)
      : 0;


  return (
    <Screen>
      <H1>Ready to Practice?</H1>

      {loadingProfiles ? (
        <View style={{ marginTop: 14, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <YStack marginTop={14} gap={14}>
          <GlassCard>
            <SectionTitle>Session</SectionTitle>

            <Muted>Profile</Muted>
            <Text color="$color" fontSize={16} fontWeight="800">
              {activeProfile ? `${activeProfile.learningName} (${activeProfile.learningCode})` : "None"}
            </Text>

            <Muted marginTop={10}>Mode</Muted>
            <Text color="$color" fontSize={16} fontWeight="800">
              {session?.type ?? "none"}
            </Text>

            <Muted marginTop={10}>Session length</Muted>
            <Text color="$color" fontSize={16} fontWeight="800">
              ~{session?.practiceBank?.length ?? 0} questions
            </Text>

            <Muted marginTop={10}>Vocab selected</Muted>
            <Text color="$color" fontSize={16} fontWeight="800">
              {session ? `${session.conceptIds.length} selected` : "0"}
            </Text>

            {/* Status messages */}
            {initializingLlm ? (
              <Text marginTop={10} color="$textMuted" fontSize={12}>
                Initializing LLM…
              </Text>
            ) : null}

            {!initializingLlm && llmReady ? (
              <Text marginTop={10} color="$green11" fontSize={12}>
                LLM ready
              </Text>
            ) : null}

            {llmError ? (
              <Text marginTop={10} color="$red10" fontSize={12}>
                {llmError}
              </Text>
            ) : null}

            {hydratingConcepts ? (
              <Text marginTop={10} color="$textMuted" fontSize={12}>
                Picking vocab…
              </Text>
            ) : null}

            {generationError ? (
              <Text marginTop={10} color="$red10" fontSize={12}>
                {generationError}
              </Text>
            ) : null}

            {generating && genStep !== null ? (
              <View style={{ marginTop: 8 }}>
                <Text color="$textMuted" fontSize={12}>
                  Generating practice item {genStep} of {genTotal}…
                </Text>

                <View
                    marginTop={6}
                    height={6}
                    borderRadius={999}
                    backgroundColor="$glassFill"
                >
                  <View
                      width={`${genProgressPct}%`}
                      height={6}
                      borderRadius={999}
                      backgroundColor="$color4"
                  />
                </View>
              </View>
            ) : null}
          </GlassCard>

          {!activeLanguageId ? <Sub>Pick a language first on Home.</Sub> : null}
          {!session ? <Sub>No active session. Go back and tap Start Learning/Review.</Sub> : null}
        </YStack>
      )}

      <HermesButton
        label={initializingLlm || hydratingConcepts || generating ? "Preparing…" : "Start Session"}
        variant="primary"
        disabled={!canStart}
        onPress={() => router.replace("/(app)/session/concept")}
      />
    </Screen>
  );
}
