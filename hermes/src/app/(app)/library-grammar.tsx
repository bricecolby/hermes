// app/(tabs)/grammar/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { YStack, Text, ScrollView, Separator } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { HermesAccordion } from "@/components/ui/Accordion";
import { CEFRTabs, type CefrLevel } from "@/components/ui/CEFRTabs";
import { useAppState } from "@/state/AppState";
import { AppHeader } from "@/components/ui/AppHeader";

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

function extractCefrFromTagName(name: string): CefrLevel | null {
  const n = name.trim().toUpperCase();
  if ((CEFR_ORDER as readonly string[]).includes(n)) return n as CefrLevel;
  if (n.startsWith("CEFR:")) {
    const lvl = n.replace("CEFR:", "").trim();
    if ((CEFR_ORDER as readonly string[]).includes(lvl)) return lvl as CefrLevel;
  }
  return null;
}

export default function GrammarLibraryScreen() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId } = useAppState();

  const [lessons, setLessons] = useState<LessonVM[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLevel, setSelectedLevel] = useState<CefrLevel>("A1");
  const [levelCounts, setLevelCounts] = useState<Partial<Record<CefrLevel, number>>>({});
  const [pointLevels, setPointLevels] = useState<Record<number, Set<CefrLevel>>>({});

  useEffect(() => {
    let cancelled = false;

    async function load(languageId: number) {
      setLoading(true);

      const lessonRows = await listTopLevelGrammarLessons(db, languageId);
      const lessonVMs: LessonVM[] = [];

      for (const lesson of lessonRows) {
        const points = await listGrammarPointsForSection(db, lesson.id);
        lessonVMs.push({ ...lesson, points, expanded: false });
      }

      const allPoints = await listGrammarPointsByLanguage(db, languageId);
      const counts: Partial<Record<CefrLevel, number>> = {};
      const pLevels: Record<number, Set<CefrLevel>> = {};

      for (const gp of allPoints) {
        const tags = await listTagsForGrammarPoint(db, gp.id);
        for (const t of tags) {
          const lvl = extractCefrFromTagName(t.name);
          if (!lvl) continue;

          if (!pLevels[gp.id]) pLevels[gp.id] = new Set<CefrLevel>();
          if (!pLevels[gp.id].has(lvl)) {
            pLevels[gp.id].add(lvl);
            counts[lvl] = (counts[lvl] ?? 0) + 1;
          }
        }
      }

      if (!cancelled) {
        setLessons(lessonVMs);
        setPointLevels(pLevels);
        setLevelCounts(counts);
        setLoading(false);
      }
    }

    const languageId = Number(activeLanguageId);
    if (!Number.isFinite(languageId)) return;

    load(languageId);
    return () => {
      cancelled = true;
    };
  }, [db, activeLanguageId]);

  const hasAnythingAtAll = useMemo(
    () => Object.values(levelCounts).some((c) => (c ?? 0) > 0),
    [levelCounts]
  );

  const hasSelected = (levelCounts[selectedLevel] ?? 0) > 0;

  const filteredLessons = useMemo(() => {
    if (!hasAnythingAtAll) return lessons;

    return lessons
      .map((l) => ({
        ...l,
        points: l.points.filter((p) => pointLevels[p.id]?.has(selectedLevel)),
      }))
      .filter((l) => l.points.length > 0);
  }, [lessons, pointLevels, selectedLevel, hasAnythingAtAll]);

  if (loading) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4">
          <Text color="$color11">Loading…</Text>
        </YStack>
      </Screen>
    );
  }

  return (
    <Screen noPad>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2" gap="$2">
          <AppHeader title="Grammar" />

          <CEFRTabs value={selectedLevel} onChange={setSelectedLevel} />
        </YStack>

        {/* Content */}
        {!hasAnythingAtAll ? (
          <YStack flex={1} padding="$4" gap="$3" backgroundColor="$glassFill">
            <Text fontSize="$7" fontWeight="800" color="$color">
              Coming soon.
            </Text>
            <Text color="$color11">
              This language pack doesn’t include grammar content yet—but it will.
            </Text>
          </YStack>
        ) : !hasSelected ? (
          <YStack flex={1} padding="$4" gap="$3">
            <Text fontSize="$7" fontWeight="800" color="$color">
              Nothing in {selectedLevel} yet
            </Text>
            <Text color="$color11">
              Try another level to see what’s available.
            </Text>
          </YStack>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <YStack>
              {filteredLessons.map((lesson) => (
                <HermesAccordion
                  key={lesson.id}
                  title={lesson.title}
                  subtitle={`${lesson.points.length} items${
                    lesson.description ? ` • ${lesson.description}` : ""
                  }`}
                  expanded={lesson.expanded}
                  onToggle={() =>
                    setLessons((prev) =>
                      prev.map((l) =>
                        l.id === lesson.id ? { ...l, expanded: !l.expanded } : l
                      )
                    )
                  }
                >
                  <YStack>
                    {lesson.points.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => router.push(`/grammar/${p.id}`)}
                        activeOpacity={0.85}
                      >
                        <YStack
                          paddingHorizontal="$4"
                          paddingVertical="$3"
                          borderTopWidth={1}
                          borderColor="$borderColor"
                          gap="$1"
                        >
                          <Text fontSize="$5" fontWeight="700" color="$color">
                            {p.title}
                          </Text>
                          <Text fontSize="$3" color="$color11" numberOfLines={2}>
                            {p.summary ?? "No summary yet."}
                          </Text>
                        </YStack>
                      </TouchableOpacity>
                    ))}
                  </YStack>
                </HermesAccordion>
              ))}
            </YStack>
          </ScrollView>
        )}
      </YStack>
    </Screen>
  );
}
