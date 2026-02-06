import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";

import { YStack, Text, ScrollView, XStack, useTheme } from "tamagui";

import { Screen } from "../../components/ui/Screen";
import { AppHeader } from "../../components/ui/AppHeader";
import { ActionCard } from "../../components/ui/ActionCard";
import { useAppState } from "../../state/AppState";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../db/queries/users";
import { CefrProgressWidget } from "@/components/ui/CefrProgressWidget";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReviewForecast } from "@/components/ui/ReviewForecast";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { resolveThemeColor } from "@/components/ui/themeColor";
import {
  getLearnSettings,
  getLearnCompletedTodayByKind,
  getLearnChunkProgressByKind,
  type LearnSettings,
} from "@/db/queries/learn";

const MVP_USERNAME = "default";

type LearnStats = {
  chunkCompleted: number;
  chunkTarget: number;
  vocabCompletedToday: number;
  grammarCompletedToday: number;
};

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function PillRow({ total, filled }: { total: number; filled: number }) {
  const theme = useTheme();
  const safeFilled = Math.min(Math.max(filled, 0), total);
  const [width, setWidth] = useState(0);
  const minPillWidth = 2;
  const gap = Math.max(1, Math.floor(minPillWidth / 2));
  const maxPillsForWidth = width > 0 ? Math.floor((width + gap) / (minPillWidth + gap)) : total;
  const count = width > 0 ? Math.min(total, maxPillsForWidth) : total;
  const pillWidth =
    width > 0 && count > 0
      ? Math.max(minPillWidth, Math.floor((width - gap * (count - 1)) / count))
      : minPillWidth;
  const pillHeight = Math.max(3, Math.floor(pillWidth * 0.6));
  const fillColor = resolveThemeColor(theme.gradB, "rgba(215, 255, 235, 0.9)");

  return (
    <YStack
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <XStack gap={gap} flexWrap="nowrap">
        {Array.from({ length: count }).map((_, i) => (
          <YStack
            key={i}
            width={pillWidth}
            height={pillHeight}
            borderRadius={999}
            backgroundColor={i < safeFilled ? fillColor : "rgba(255,255,255,0.12)"}
          />
        ))}
      </XStack>
    </YStack>
  );
}

export default function Home() {
  const router = useRouter();
  const { activeProfileId, activeLanguageId, session, startSession } = useAppState();
  const insets = useSafeAreaInsets();

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
  const [learnExpanded, setLearnExpanded] = useState(false);
  const [learnLoading, setLearnLoading] = useState(false);
  const [learnSettings, setLearnSettings] = useState<LearnSettings | null>(null);
  const [learnStats, setLearnStats] = useState<LearnStats>({
    chunkCompleted: 0,
    chunkTarget: 0,
    vocabCompletedToday: 0,
    grammarCompletedToday: 0,
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

    const nowIso = new Date().toISOString();

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
          AND ucm.due_at < ?
        GROUP BY c.kind;
        `,
        [activeLanguageId, activeProfileId, "ema_v1", nowIso]
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

  const loadLearnStats = useCallback(async () => {
    if (!activeProfileId || !activeLanguageId) {
      setLearnSettings(null);
      setLearnStats({
        chunkCompleted: 0,
        chunkTarget: 0,
        vocabCompletedToday: 0,
        grammarCompletedToday: 0,
      });
      return;
    }

    try {
      setLearnLoading(true);
      const settings = await getLearnSettings(db, {
        userId: activeProfileId,
        languageId: activeLanguageId,
      });
      setLearnSettings(settings);

      const [vocabProgress, grammarProgress] = await Promise.all([
        getLearnChunkProgressByKind(db, {
          userId: activeProfileId,
          languageId: activeLanguageId,
          kind: "vocab_item",
        }),
        getLearnChunkProgressByKind(db, {
          userId: activeProfileId,
          languageId: activeLanguageId,
          kind: "grammar_point",
        }),
      ]);

      const sinceIso = startOfDayIso();
      const [vocabToday, grammarToday] = await Promise.all([
        getLearnCompletedTodayByKind(db, {
          userId: activeProfileId,
          languageId: activeLanguageId,
          kind: "vocab_item",
          sinceIso,
        }),
        getLearnCompletedTodayByKind(db, {
          userId: activeProfileId,
          languageId: activeLanguageId,
          kind: "grammar_point",
          sinceIso,
        }),
      ]);

      setLearnStats({
        chunkCompleted: vocabToday + grammarToday,
        chunkTarget: settings.vocabDailyTarget + settings.grammarDailyTarget,
        vocabCompletedToday: vocabToday,
        grammarCompletedToday: grammarToday,
      });
    } catch (e) {
      console.warn("[home] learn stats failed", e);
    } finally {
      setLearnLoading(false);
    }
  }, [activeLanguageId, activeProfileId, db]);

  useFocusEffect(
    useCallback(() => {
      setCefrNonce((n) => n + 1);
      loadProfiles();
      loadReviewCounts();
      loadLearnStats();
    }, [loadProfiles, loadReviewCounts, loadLearnStats])
  );


  useEffect(() => {
    if (!activeProfileId) router.replace("/(onboarding)/profile");
  }, [activeProfileId, router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
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
                  title="Learn"
                  subtitle={
                    learnLoading ? "Loading learn queue…" : undefined
                  }
                  disabled={!activeLanguageId}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/learn/concept",
                      params: { run: String(Date.now()) },
                    })
                  }
                  showChevron
                  chevronOpen={learnExpanded}
                  onChevronPress={() => setLearnExpanded((v) => !v)}
                  rightSlot={
                    <Text color="$textMuted" fontSize={12} fontWeight="800">
                      {learnLoading
                        ? "…"
                        : `${learnStats.chunkCompleted}/${learnStats.chunkTarget}`}
                    </Text>
                  }
                  footer={
                    <YStack gap={12}>
                      <PillRow
                        total={learnStats.chunkTarget}
                        filled={learnStats.chunkCompleted}
                      />

                      {learnExpanded ? (
                        <YStack gap={12}>
                          <XStack
                            alignItems="center"
                            justifyContent="space-between"
                            paddingVertical={6}
                          >
                            <YStack gap={4} flex={1}>
                              <XStack alignItems="center" justifyContent="space-between">
                                <Text fontSize={14} fontWeight="800" color="$color">
                                  Vocab
                                </Text>
                                <Text color="$textMuted" fontSize={12} fontWeight="800">
                                  {learnSettings
                                    ? `${learnStats.vocabCompletedToday}/${learnSettings.vocabDailyTarget}`
                                    : "—"}
                                </Text>
                              </XStack>
                              <PillRow
                                total={learnSettings?.vocabDailyTarget ?? 0}
                                filled={learnStats.vocabCompletedToday}
                              />
                            </YStack>
                            <YStack alignItems="center" marginLeft={10}>
                              <TouchableOpacity
                                onPress={() => router.push("/(modals)/learn-settings")}
                                activeOpacity={0.8}
                              >
                                <IconSymbol
                                  name="ellipsis"
                                  size={18}
                                  weight="medium"
                                  color="rgba(255,255,255,0.7)"
                                />
                              </TouchableOpacity>
                            </YStack>
                          </XStack>

                          <XStack
                            alignItems="center"
                            justifyContent="space-between"
                            paddingVertical={6}
                          >
                            <YStack gap={4} flex={1}>
                              <XStack alignItems="center" justifyContent="space-between">
                                <Text fontSize={14} fontWeight="800" color="$color">
                                  Grammar
                                </Text>
                                <Text color="$textMuted" fontSize={12} fontWeight="800">
                                  {learnSettings
                                    ? `${learnStats.grammarCompletedToday}/${learnSettings.grammarDailyTarget}`
                                    : "—"}
                                </Text>
                              </XStack>
                              <PillRow
                                total={learnSettings?.grammarDailyTarget ?? 0}
                                filled={learnStats.grammarCompletedToday}
                              />
                            </YStack>
                            <YStack alignItems="center" marginLeft={10}>
                              <TouchableOpacity
                                onPress={() => router.push("/(modals)/learn-settings")}
                                activeOpacity={0.8}
                              >
                                <IconSymbol
                                  name="ellipsis"
                                  size={18}
                                  weight="medium"
                                  color="rgba(255,255,255,0.7)"
                                />
                              </TouchableOpacity>
                            </YStack>
                          </XStack>

                          <TouchableOpacity
                            onPress={() => router.push("/(modals)/learn-settings")}
                            activeOpacity={0.8}
                          >
                            <XStack
                              alignItems="center"
                              justifyContent="space-between"
                              paddingVertical={6}
                            >
                              <Text fontSize={14} fontWeight="800" color="$color">
                                Learn Queue Settings
                              </Text>
                              <IconSymbol
                                name="gearshape"
                                size={18}
                                weight="medium"
                                color="rgba(255,255,255,0.7)"
                              />
                            </XStack>
                          </TouchableOpacity>
                        </YStack>
                      ) : null}
                    </YStack>
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
                  title="Apply"
                  subtitle="Freeform chat practice"
                  disabled={!activeLanguageId}
                  onPress={() => router.push("/(app)/apply")}
                />

                <ActionCard
                  title="Review"
                  subtitle={
                    reviewLoading
                      ? "Loading reviews…"
                      : reviewCounts.total > 0
                        ? `You have ${reviewCounts.total} reviews overdue.`
                        : "No reviews are overdue right now."
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
                              {reviewCounts.grammar > 0 ? "Overdue" : "No overdue reviews."}
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
                              {reviewCounts.vocab > 0 ? "Overdue" : "No overdue reviews."}
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
