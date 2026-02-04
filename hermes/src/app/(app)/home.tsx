import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";

import { YStack, Text, ScrollView, XStack } from "tamagui";

import { Screen } from "../../components/ui/Screen";
import { AppHeader } from "../../components/ui/AppHeader";
import { ActionCard } from "../../components/ui/ActionCard";
import { useAppState } from "../../state/AppState";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../db/queries/users";
import { CefrProgressWidget } from "@/components/ui/CefrProgressWidget";
import { useFocusEffect } from "@react-navigation/native";
import { ReviewForecast } from "@/components/ui/ReviewForecast";

const MVP_USERNAME = "default";

export default function Home() {
  const router = useRouter();
  const { activeProfileId, activeLanguageId, session, startSession } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const db = SQLite.useSQLiteContext();

  const [cefrNonce, setCefrNonce] = useState(0);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewCounts, setReviewCounts] = useState({
    total: 0,
    vocab: 0,
    grammar: 0,
  });

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
      setProfiles(rows);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const loadReviewCounts = useCallback(async () => {
    if (!activeProfileId || !activeLanguageId) {
      setReviewCounts({ total: 0, vocab: 0, grammar: 0 });
      return;
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    try {
      setReviewLoading(true);
      const rows = await db.getAllAsync<{ kind: string; count: number }>(
        `
        SELECT c.kind AS kind, COUNT(*) AS count
        FROM user_concept_mastery ucm
        JOIN concepts c
          ON c.id = ucm.concept_id
         AND c.language_id = ?
        WHERE ucm.user_id = ?
          AND ucm.model_key = ?
          AND ucm.due_at IS NOT NULL
          AND ucm.due_at <= ?
        GROUP BY c.kind;
        `,
        [activeLanguageId, activeProfileId, "ema_v1", end.toISOString()]
      );

      const next = { total: 0, vocab: 0, grammar: 0 };
      for (const r of rows) {
        if (r.kind === "vocab_item") next.vocab = Number(r.count ?? 0);
        if (r.kind === "grammar_point") next.grammar = Number(r.count ?? 0);
      }
      next.total = next.vocab + next.grammar;
      setReviewCounts(next);
    } catch (e) {
      console.warn("[home] review counts failed", e);
      setReviewCounts({ total: 0, vocab: 0, grammar: 0 });
    } finally {
      setReviewLoading(false);
    }
  }, [activeLanguageId, activeProfileId, db]);

  useFocusEffect(
    useCallback(() => {
      setCefrNonce((n) => n + 1);
      loadProfiles();
      loadReviewCounts();
    }, [loadProfiles, loadReviewCounts])
  );


  useEffect(() => {
    if (!activeProfileId) router.replace("/(onboarding)/profile");
  }, [activeProfileId, router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        <YStack paddingTop={6}>
          <AppHeader title="Home" />

          {!loading && activeProfileId ? (
            <>
              <YStack gap={16} marginTop={6}>
                <CefrProgressWidget
                  db={db}
                  userId={activeProfileId}
                  languageId={activeLanguageId ?? null}
                  modelKey="ema_v1"
                  refreshNonce={cefrNonce}
                />

                <ReviewForecast
                  userId={activeProfileId}
                  daysToShow={14}
                  modelKey="ema_v1"
                />
              </YStack>

            </>
          ) : null}

          <YStack marginTop={18} gap={12}>
            {session ? (
              <ActionCard
                title="Continue Session"
                subtitle={`${session.type} • step ${session.practiceIndex + 1}`}
                onPress={() => router.push("/(app)/session/concept")}
              />
            ) : (
              <>
                <ActionCard
                  title="Memorize"
                  subtitle="Vocab and Grammar"
                  disabled={!activeLanguageId}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/memorize",
                      params: { run: String(Date.now()) },
                    })
                  }
                />

                <ActionCard
                  title="Practice"
                  subtitle="New concepts"
                  disabled={!activeLanguageId}
                  onPress={() => {
                    startSession("learn");
                    router.push("/(app)/session/setup");
                  }}
                />

                <ActionCard
                  title="Review"
                  subtitle={
                    reviewLoading
                      ? "Loading reviews…"
                      : reviewCounts.total > 0
                        ? `You have ${reviewCounts.total} reviews ready today.`
                        : "You have no pending reviews right now."
                  }
                  disabled={!activeLanguageId}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/review",
                      params: { run: String(Date.now()) },
                    })
                  }
                  showChevron
                  chevronOpen={reviewExpanded}
                  onChevronPress={() => setReviewExpanded((v) => !v)}
                  rightSlot={
                    <YStack
                      paddingVertical={6}
                      paddingHorizontal={14}
                      borderRadius={999}
                      backgroundColor="rgba(0,0,0,0.35)"
                      borderWidth={1}
                      borderColor="rgba(255,255,255,0.08)"
                    >
                      <Text color="$textMuted" fontSize={12} fontWeight="800">
                        {reviewLoading ? "…" : `${reviewCounts.total}`}
                      </Text>
                  </YStack>
                  }

                  footer={
                    reviewExpanded ? (
                      <YStack gap={10}>
                        <XStack
                          alignItems="center"
                          justifyContent="space-between"
                          paddingVertical={6}
                        >
                          <YStack gap={2}>
                            <Text fontSize={14} fontWeight="800" color="$color">
                              Grammar
                            </Text>
                            <Text color="$textMuted" fontSize={12}>
                              {reviewCounts.grammar > 0 ? "Ready to review" : "No reviews yet."}
                            </Text>
                          </YStack>
                          <YStack
                            paddingVertical={6}
                            paddingHorizontal={14}
                            borderRadius={999}
                            backgroundColor="rgba(0,0,0,0.35)"
                            borderWidth={1}
                            borderColor="rgba(255,255,255,0.08)"
                          >
                            <Text fontWeight="900" color="$color">
                              {reviewLoading ? "—" : reviewCounts.grammar}
                            </Text>
                          </YStack>
                        </XStack>

                        <XStack
                          alignItems="center"
                          justifyContent="space-between"
                          paddingVertical={6}
                        >
                          <YStack gap={2}>
                            <Text fontSize={14} fontWeight="800" color="$color">
                              Vocab
                            </Text>
                            <Text color="$textMuted" fontSize={12}>
                              {reviewCounts.vocab > 0 ? "Ready to review" : "No reviews yet."}
                            </Text>
                          </YStack>
                          <YStack
                            paddingVertical={6}
                            paddingHorizontal={14}
                            borderRadius={999}
                            backgroundColor="rgba(0,0,0,0.35)"
                            borderWidth={1}
                            borderColor="rgba(255,255,255,0.08)"
                          >
                            <Text fontWeight="900" color="$color">
                              {reviewLoading ? "—" : reviewCounts.vocab}
                            </Text>
                          </YStack>
                        </XStack>
                      </YStack>
                    ) : null
                  }
                />

                <ActionCard
                  title="Switch Profile"
                  subtitle="Choose a different language pack"
                  onPress={() => router.push("/(onboarding)/profile")}
                />
              </>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </Screen>
  );
}
