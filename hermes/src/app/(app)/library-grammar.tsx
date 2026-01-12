// app/(tabs)/grammar/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { YStack, XStack, Text, ScrollView, Separator } from "tamagui";

import { useAppState } from "@/state/AppState";

import {
  listTopLevelGrammarLessons,
  listGrammarPointsForSection,
  type GrammarSectionWithCount,
  type GrammarPointListItem,
  listGrammarPointsByLanguage,
  listTagsForGrammarPoint,
} from "@/db/queries/grammar";

type LessonVM = GrammarSectionWithCount & {
  points: GrammarPointListItem[];
  expanded: boolean;
};

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function extractCefrFromTagName(name: string): string | null {
  const n = name.trim().toUpperCase();
  if (CEFR_ORDER.includes(n as any)) return n;
  if (n.startsWith("CEFR:")) {
    const lvl = n.replace("CEFR:", "").trim();
    if (CEFR_ORDER.includes(lvl as any)) return lvl;
  }
  return null;
}

export default function GrammarLibraryScreen() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId } = useAppState();

  const [lessons, setLessons] = useState<LessonVM[]>([]);
  const [cefrCoverage, setCefrCoverage] = useState<string>("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLanguageId) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          "[GrammarLibraryScreen] activeLanguageId is null. This screen should be gated behind profile selection."
        );
      }
    }
  }, [activeLanguageId]);

  useEffect(() => {
    let cancelled = false;

    async function load(languageId: number) {
      setLoading(true);

      const lessonRows = await listTopLevelGrammarLessons(db, languageId);
      const lessonVMs: LessonVM[] = [];

      for (const lesson of lessonRows) {
        const points = await listGrammarPointsForSection(db, lesson.id);
        lessonVMs.push({
          ...lesson,
          points,
          expanded: false,
        });
      }

      const allPoints = await listGrammarPointsByLanguage(db, languageId);
      const seen = new Set<string>();

      for (const gp of allPoints) {
        const tags = await listTagsForGrammarPoint(db, gp.id);
        for (const t of tags) {
          const lvl = extractCefrFromTagName(t.name);
          if (lvl) seen.add(lvl);
        }
      }

      const levels = CEFR_ORDER.filter((l) => seen.has(l));
      const coverage =
        levels.length === 0
          ? "No CEFR tags"
          : levels.length === 1
          ? levels[0]
          : `Mixed (${levels[0]}–${levels[levels.length - 1]})`;

      if (!cancelled) {
        setLessons(lessonVMs);
        setCefrCoverage(coverage);
        setLoading(false);
      }
    }

    const languageId = Number(activeLanguageId);
    if (!Number.isFinite(languageId)) {
      if (__DEV__) {
        throw new Error(
          `[GrammarLibraryScreen] activeLanguageId "${activeLanguageId}" is not numeric, but DB queries expect a number.`
        );
      }
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    load(languageId);

    return () => {
      cancelled = true;
    };
  }, [db, activeLanguageId]);

  const headerSubtitle = useMemo(() => {
    if (loading) return "Loading…";
    return `Coverage: ${cefrCoverage}`;
  }, [loading, cefrCoverage]);

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="$background" paddingHorizontal="$4" paddingTop="$4">
        <Text color="$color11">Loading…</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack
        paddingHorizontal="$4"
        paddingTop="$4"
        paddingBottom="$3"
        gap="$2"
      >
        <Text fontSize="$8" fontWeight="700">
          Grammar
        </Text>

        <XStack gap="$2" alignItems="center">
          <XStack
            backgroundColor="$color2"
            borderRadius="$6"
            paddingHorizontal="$3"
            paddingVertical="$2"
            alignItems="center"
          >
            <Text fontSize="$3" color="$color11">
              {headerSubtitle}
            </Text>
          </XStack>

          <XStack
            backgroundColor="$color3"
            borderRadius="$6"
            paddingHorizontal="$3"
            paddingVertical="$2"
            alignItems="center"
          >
            <Text fontSize="$3" color="$color11">
              Analytics (soon)
            </Text>
          </XStack>
        </XStack>
      </YStack>

      <Separator />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <YStack gap="$3">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onToggle={() => {
                setLessons((prev) =>
                  prev.map((l) =>
                    l.id === lesson.id ? { ...l, expanded: !l.expanded } : l
                  )
                );
              }}
              onPressPoint={(pointId) => router.push(`/grammar/${pointId}`)}
            />
          ))}

          {lessons.length === 0 && (
            <Text color="$color11">No grammar lessons yet.</Text>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function LessonCard({
  lesson,
  onToggle,
  onPressPoint,
}: {
  lesson: LessonVM;
  onToggle: () => void;
  onPressPoint: (grammarPointId: number) => void;
}) {
  return (
    <YStack
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$6"
      overflow="hidden"
      backgroundColor="$color1"
    >
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$1">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$6" fontWeight="700">
              {lesson.title}
            </Text>
            <Text color="$color11">{lesson.expanded ? "▾" : "▸"}</Text>
          </XStack>

          <XStack gap="$2" alignItems="center">
            <Text fontSize="$3" color="$color11">
              {lesson.point_count} items
            </Text>
            {lesson.description ? (
              <Text fontSize="$3" color="$color11" numberOfLines={1}>
                • {lesson.description}
              </Text>
            ) : null}
          </XStack>
        </YStack>
      </TouchableOpacity>

      {lesson.expanded ? (
        <YStack borderTopWidth={1} borderColor="$borderColor">
          {lesson.points.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => onPressPoint(p.id)}
              activeOpacity={0.8}
            >
              <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$1">
                <Text fontSize="$5" fontWeight="600">
                  {p.title}
                </Text>
                {p.summary ? (
                  <Text fontSize="$3" color="$color11" numberOfLines={2}>
                    {p.summary}
                  </Text>
                ) : (
                  <Text fontSize="$3" color="$color11">
                    (No summary yet)
                  </Text>
                )}
              </YStack>
            </TouchableOpacity>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
