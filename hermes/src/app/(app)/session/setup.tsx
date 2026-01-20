import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Text, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, Sub, Muted, SectionTitle } from "../../../components/ui/Typography";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../../db/queries/users";
import { getRandomVocab } from "@/db/queries/vocab";

import { llmClient } from "shared/services/llm/client";
import { PracticeItemGenerator } from "shared/services/practiceGeneration/PracticeItemGenerator";
import { buildGenerationContext } from "shared/services/practiceGeneration/context/buildGenerationContext";
import { registerPracticeItemSpecs } from "shared/services/practiceGeneration/specs/registerPracticeItemSpecs";

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
  } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [initializingLlm, setInitializingLlm] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [hydratingConcepts, setHydratingConcepts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

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

  // Step 0: Initialize LLM 
  useEffect(() => {
    let cancelled = false;

    async function initLlm() {
      if (!session || !activeLanguageId) return;
      if (llmClient.isReady() || initializingLlm) return;

      try {
        setInitializingLlm(true);
        setLlmError(null);
        await llmClient.ensureReady();
      } catch (e: any) {
        if (!cancelled) setLlmError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setInitializingLlm(false);
      }
    }

    initLlm();

    return () => {
      cancelled = true;
    };
  }, [session?.id, activeLanguageId, initializingLlm]);

  // Step 1: pick 5 random vocab rows (vocab IDs are used as "conceptIds" for MVP).
  useEffect(() => {
    let cancelled = false;

    async function pickVocab() {
      if (!db || !activeLanguageId || !session) return;
      if (session.conceptIds.length > 0) return;

      try {
        setHydratingConcepts(true);

        const rows = await getRandomVocab(db, activeLanguageId, 5);
        if (cancelled) return;

        const vocabIds = rows.map((r) => r.id);

        // AppState ConceptRef shape, but backed by vocab rows for now.
        const refs = rows.map((r) => ({
          conceptId: r.id,
          kind: "vocab" as const,
          refId: r.id,
          title: r.base_form ?? null,
          description: r.translation ?? null,
        }));

        hydrateSessionConceptIds(vocabIds);
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
  }, [db, activeLanguageId, session?.id]);

  // Step 2: generate practice bank once vocab exists AND LLM is ready.
  useEffect(() => {
    if (!session) return;

    const hasVocab = session.conceptIds.length > 0;
    const hasBank = (session.practiceBank?.length ?? 0) > 0;

    if (!hasVocab || hasBank || generating) return;
    if (!llmClient.isReady()) return;

    let cancelled = false;

    (async () => {
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
        const bank: any[] = [];

        for (let i = 0; i < 5; i++) {
          const type = types[i % types.length];
          const res = await generator.generate(type, ctx);
          if (cancelled) return;

          if (res.ok) bank.push(res.parsed);
          else console.warn("Generation failed:", res.error, res.rawText);
        }

        if (cancelled) return;
        hydrateSessionPracticeBank(bank);
      } catch (e: any) {
        if (!cancelled) setGenerationError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    session?.id,
    session?.conceptIds.join(","),
    session?.practiceBank?.length,
    activeProfileId,
    generating,
  ]);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  const canStart =
    !!session &&
    !!activeLanguageId &&
    !initializingLlm &&
    !hydratingConcepts &&
    !generating &&
    (session?.practiceBank?.length ?? 0) > 0;

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

            {initializingLlm ? (
              <Text marginTop={10} color="$textMuted" fontSize={12}>
                Initializing LLM…
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

            {generating ? (
              <Text marginTop={10} color="$textMuted" fontSize={12}>
                Generating practice…
              </Text>
            ) : null}

            {generationError ? (
              <Text marginTop={10} color="$red10" fontSize={12}>
                {generationError}
              </Text>
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
