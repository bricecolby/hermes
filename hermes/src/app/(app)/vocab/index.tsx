// src/app/(app)/vocab/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { YStack, XStack, Text, ScrollView } from "tamagui";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { HermesAccordion } from "@/components/ui/Accordion";
import { CEFRTabs, type CefrLevel } from "@/components/ui/CEFRTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { useAppState } from "@/state/AppState";
import { HeaderSearchOverlay } from "@/components/ui/HeaderSearchOverlay";

import { Plus } from "@tamagui/lucide-icons";

import {
  listVocabItemsByLanguage,
  listTagsForItem,
  type VocabItemRow,
} from "@/db/queries/vocab";

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

type GroupVM = {
  key: string; // part_of_speech
  title: string;
  count: number;
  expanded: boolean;
  items: VocabItemRow[];
};

function titleizePos(pos: string) {
  const p = pos.trim();
  if (!p) return "Other";
  return p[0].toUpperCase() + p.slice(1);
}

export default function VocabLibraryScreen() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId } = useAppState();

  const [loading, setLoading] = useState(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hasQuery = query.trim().length > 0;

  const [selectedLevel, setSelectedLevel] = useState<CefrLevel>("A1");
  const [levelCounts, setLevelCounts] = useState<Partial<Record<CefrLevel, number>>>({});
  const [itemLevels, setItemLevels] = useState<Record<number, Set<CefrLevel>>>({});

  const [groups, setGroups] = useState<GroupVM[]>([]);

  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setRefreshNonce((prev) => prev + 1);
    }, [])
  )


  useEffect(() => {
    let cancelled = false;

    async function load(languageId: number) {
      setLoading(true);

      // 1) load items
      const items = await listVocabItemsByLanguage(db, languageId);

      // 2) compute CEFR levels per item based on tags
      const counts: Partial<Record<CefrLevel, number>> = {};
      const levelsByItem: Record<number, Set<CefrLevel>> = {};

      for (const it of items) {
        const tags = await listTagsForItem(db, it.id);
        for (const t of tags) {
          const lvl = extractCefrFromTagName(t.name);
          if (!lvl) continue;

          if (!levelsByItem[it.id]) levelsByItem[it.id] = new Set<CefrLevel>();
          if (!levelsByItem[it.id].has(lvl)) {
            levelsByItem[it.id].add(lvl);
            counts[lvl] = (counts[lvl] ?? 0) + 1;
          }
        }
      }

      // 3) group by part_of_speech
      const byPos = new Map<string, VocabItemRow[]>();
      for (const it of items) {
        const key = (it.part_of_speech ?? "").trim().toLowerCase() || "other";
        byPos.set(key, [...(byPos.get(key) ?? []), it]);
      }

      const groupVMs: GroupVM[] = Array.from(byPos.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, list]) => ({
          key,
          title: titleizePos(key),
          count: list.length,
          expanded: false,
          items: list.sort((x, y) => x.base_form.localeCompare(y.base_form)),
        }));

      if (!cancelled) {
        setItemLevels(levelsByItem);
        setLevelCounts(counts);
        setGroups(groupVMs);
        setLoading(false);
      }
    }

    const languageId = Number(activeLanguageId);
    if (!Number.isFinite(languageId)) return;

    load(languageId);
    return () => {
      cancelled = true;
    };
  }, [db, activeLanguageId, refreshNonce]);

  const hasAnythingAtAll = useMemo(
    () => Object.values(levelCounts).some((c) => (c ?? 0) > 0),
    [levelCounts]
  );

  const hasSelected = (levelCounts[selectedLevel] ?? 0) > 0;

  const filteredGroups = useMemo(() => {

    if (hasQuery) {
      const q = query.trim().toLowerCase();
      return groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => {
            const base = it.base_form.toLowerCase();
            const notes = (it.usage_notes ?? "").toLowerCase();
            const pos = (it.part_of_speech ?? "").toLowerCase();
            return base.includes(q) || notes.includes(q) || pos.includes(q);
          }),
        }))
        .filter((g) => g.items.length > 0);
    }


    if (!hasAnythingAtAll) return groups;

    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => itemLevels[it.id]?.has(selectedLevel)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, itemLevels, selectedLevel, hasAnythingAtAll, hasQuery, query]);


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
      <YStack padding="$4" paddingBottom="$2" gap="$2">
        <YStack height={44} justifyContent="center">
          {searchOpen ? (
            <HeaderSearchOverlay
              open={searchOpen}
              onOpenChange={setSearchOpen}
              value={query}
              onChange={setQuery}
              placeholder="Search vocab"
            />
          ) : (
          <XStack alignItems="center" justifyContent="space-between" paddingRight="$2">
            <XStack flex={1} justifyContent="center">
              <AppHeader title="Vocab" />
            </XStack>

            <XStack
              paddingLeft="$2"
              gap="$3"
              alignItems="center"
            >
              <TouchableOpacity
                onPress={() => router.push("/(modals)/vocab/edit")}
                activeOpacity={0.7}
                hitSlop={10}
              >
                <Plus size={20} color="$color4" />
              </TouchableOpacity>

              <HeaderSearchOverlay
                open={false}
                onOpenChange={setSearchOpen}
                value={query}
                onChange={setQuery}
              />
            </XStack>

          </XStack>

          )}
        </YStack>

        <CEFRTabs value={selectedLevel} onChange={setSelectedLevel} />
      </YStack>


        {!hasAnythingAtAll ? (
          <YStack flex={1} padding="$4" gap="$3" backgroundColor="$glassFill">
            <Text fontSize="$7" fontWeight="800" color="$color">
              Coming soon.
            </Text>
            <Text color="$color11">This language pack doesn’t include vocab yet—but it will.</Text>
          </YStack>
        ) : !hasSelected ? (
          <YStack flex={1} padding="$4" gap="$3">
            <Text fontSize="$7" fontWeight="800" color="$color">
              Nothing in {selectedLevel} yet
            </Text>
            <Text color="$color11">Try another level to see what’s available.</Text>
          </YStack>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <YStack>
              {filteredGroups.map((g) => (
                <HermesAccordion
                  key={g.key}
                  title={g.title}
                  subtitle={`${g.items.length} items`}
                  expanded={g.expanded}
                  onToggle={() =>
                    setGroups((prev) =>
                      prev.map((x) => (x.key === g.key ? { ...x, expanded: !x.expanded } : x))
                    )
                  }
                >
                  <YStack>
                    {g.items.map((it) => (
                      <TouchableOpacity
                        key={it.id}
                        onPress={() => router.push(`/vocab/${it.id}`)}
                        activeOpacity={0.85}
                      >
                        <YStack
                          paddingHorizontal="$4"
                          paddingVertical="$3"
                          borderTopWidth={1}
                          borderColor="$borderColor"
                          gap="$1"
                        >
                          <Text fontSize="$5" fontWeight="800" color="$color">
                            {it.base_form}
                          </Text>
                          <Text fontSize="$3" color="$color11" numberOfLines={2}>
                            {it.usage_notes ?? it.part_of_speech}
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
