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
import { getConceptRefsByConceptIds } from "../../../db/queries/concepts";

const MVP_USERNAME = "default";

function buildDummyPracticeBank(conceptIds: number[]) {
  return [
    {
      type: "mcq_v1.basic",
      mode: "reception",
      skills: ["reading"],
      conceptIds,
      prompt: "Где метро?",
      choices: [
        { id: "A", text: "Там" },
        { id: "B", text: "Здесь" },
        { id: "C", text: "Сейчас" },
        { id: "D", text: "Потом" },
      ],
      correctChoiceId: "B",
    },
    {
      type: "flashcard_v1.basic",
      mode: "reception",
      skills: ["reading"],
      conceptIds,
      front: "метро",
      back: "subway",
    },
    {
      type: "cloze_v1.free_fill",
      mode: "reception",
      skills: ["reading"],
      conceptIds,
      parts: [
        { type: "text", value: "Я иду в " },
        { type: "blank", id: "b1", accepted: ["метро", "школа", "дом"], conceptId: conceptIds[0] },
        { type: "text", value: "." },
      ],
    },
  ];
}


export default function SessionSetup() {
  const router = useRouter();
  const db = useSQLiteContext();

  const {
    session,
    activeProfileId,
    activeLanguageId,
    hydrateSessionConceptRefs,
    hydrateSessionPracticeBank,
  } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [hydratingConcepts, setHydratingConcepts] = useState(false);

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

  useEffect(() => {
    if (!session) return;
    if (session.conceptRefs.length > 0) return;

    let cancelled = false;

    (async () => {
      setHydratingConcepts(true);
      try {
        const refs = await getConceptRefsByConceptIds(db, session.conceptIds);
        if (cancelled) return;
        hydrateSessionConceptRefs(refs);
      } finally {
        if (!cancelled) setHydratingConcepts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, session?.id]); 

  useEffect(() => {
    if (!session) return;
    if (session.practiceBank.length > 0) return;

    const bank = buildDummyPracticeBank(session.conceptIds);
    hydrateSessionPracticeBank(bank);
  }, [session?.id]);


  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  const canStart = !!session && !!activeLanguageId && !hydratingConcepts;

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
              ~{session?.practiceBank.length ?? 0} questions
            </Text>

            <Muted marginTop={10}>Concepts</Muted>
            <Text color="$color" fontSize={16} fontWeight="800">
              {session ? `${session.conceptIds.length} selected` : "0"}
            </Text>

            {hydratingConcepts ? (
              <Text marginTop={10} color="$textMuted" fontSize={12}>
                Preparing review content…
              </Text>
            ) : null}
          </GlassCard>

          {!activeLanguageId ? <Sub>Pick a language first on Home.</Sub> : null}
          {!session ? <Sub>No active session. Go back and tap Start Learning/Review.</Sub> : null}
        </YStack>
      )}

      <HermesButton
        label={hydratingConcepts ? "Preparing…" : "Start Session"}
        variant="primary"
        disabled={!canStart}
        onPress={() => router.replace("/(app)/session/concept")}
      />
    </Screen>
  );
}
