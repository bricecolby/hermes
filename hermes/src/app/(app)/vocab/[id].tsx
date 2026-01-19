// src/app/(app)/vocab/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { ScrollView, Separator, XStack, YStack, Text } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { GradientTabs } from "@/components/ui/GradientTabs";

import {
  getVocabItem,
  listSensesForItem,
  listFormsForItem,
  listTagsForItem,
  listExamplesForSense,
  type VocabItemRow,
  type VocabSenseRow,
  type VocabFormRow,
  type VocabTagRow,
  type VocabExampleRow,
} from "@/db/queries/vocab";

type TabKey = "meaning" | "examples" | "resources";

const TABS: { key: TabKey; label: string }[] = [
  { key: "meaning", label: "Meaning" },
  { key: "examples", label: "Examples" },
  { key: "resources", label: "Resources" },
];

export default function VocabDetailScreen() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();

  const params = useLocalSearchParams<{ id?: string }>();
  const vocabItemId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);

  const [item, setItem] = useState<VocabItemRow | null>(null);
  const [senses, setSenses] = useState<VocabSenseRow[]>([]);
  const [forms, setForms] = useState<VocabFormRow[]>([]);
  const [tags, setTags] = useState<VocabTagRow[]>([]);
  const [examplesBySense, setExamplesBySense] = useState<Record<number, VocabExampleRow[]>>({});
  const [error, setError] = useState<string | null>(null);


  const [tab, setTab] = useState<TabKey>("meaning");
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<TabKey, number>>>({});

  const scrollToSection = (key: TabKey) => {
    const y = sectionY.current[key];
    if (y == null) return;
    setTab(key);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!Number.isFinite(vocabItemId)) return;

      setLoading(true);
      setItem(null);
      setSenses([]);
      setForms([]);
      setTags([]);
      setExamplesBySense({});

      const mark = (label: string) => console.log(`[vocab detail] ${label}`);

      try {
        mark(`start id=${vocabItemId}`);

        mark("getVocabItem");
        const it = await getVocabItem(db, vocabItemId);

        mark("listSensesForItem");
        const ss = await listSensesForItem(db, vocabItemId);

        mark("listFormsForItem");
        const ff = await listFormsForItem(db, vocabItemId);

        mark("listTagsForItem");
        const tg = await listTagsForItem(db, vocabItemId);

        mark(`listExamplesForSense x${ss.length}`);
        const exPairs = await Promise.all(
          ss.map(async (s) => {
            const ex = await listExamplesForSense(db, s.id);
            return [s.id, ex] as const;
          })
        );

        const exMap: Record<number, VocabExampleRow[]> = {};
        for (const [senseId, ex] of exPairs) exMap[senseId] = ex;

        if (!cancelled) {
          setItem(it ?? null);
          setSenses(ss);
          setForms(ff);
          setTags(tg);
          setExamplesBySense(exMap);
          setLoading(false);
        }

        mark("done");
      } catch (e: any) {
        console.error("[vocab detail] load failed", e);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [db, vocabItemId]);


  const primaryTranslation = useMemo(() => {
    const first = senses[0];
    return first?.translation ?? first?.definition ?? null;
  }, [senses]);

  // stub analytics for now
  const progress = useMemo(() => {
    return {
      addedOn: item?.created_at ?? null,
      timesStudied: 0,
      accuracyPct: 0,
      stageLabel: "Novice",
      ghostSlayed: 0,
    };
  }, [item]);

  // stub resources for now
  const resources = useMemo(() => {
    return [] as Array<{ id: string; title: string; subtitle?: string }>;
  }, []);

  if (!Number.isFinite(vocabItemId)) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
          <AppHeader title="Vocab" />
          <Text color="$color11">Invalid vocab item id.</Text>
        </YStack>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4">
          <Text color="$color11">Loading…</Text>
        </YStack>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
          <AppHeader title="Vocab" />
          <Text fontSize="$7" fontWeight="800" color="$color">
            Not found
          </Text>
          <Text color="$color11">This vocab item doesn’t exist (or isn’t seeded).</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text color="$color" textDecorationLine="underline">
              Go back
            </Text>
          </TouchableOpacity>
        </YStack>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
          <AppHeader title="Vocab" />
          <Text fontSize="$7" fontWeight="800" color="$color">Couldn’t load</Text>
          <Text color="$color11">{error}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text color="$color" textDecorationLine="underline">Go back</Text>
          </TouchableOpacity>
        </YStack>
      </Screen>
    );
  }


  return (
    <Screen noPad>
      <YStack flex={1} backgroundColor="$background">
        <ScrollView
          ref={scrollRef}
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Top header block */}
          <YStack padding="$4" paddingBottom="$2" gap="$2">
            <AppHeader title="Vocab Info" subtitle={item.base_form} />

            <YStack alignItems="center" paddingVertical="$4" gap="$2">
              <Text fontSize="$8" fontWeight="900" color="$color">
                {item.base_form}
              </Text>

              <Text fontSize="$6" color="$color11" textAlign="center">
                {primaryTranslation ?? item.part_of_speech}
              </Text>
            </YStack>

            {item.usage_notes ? (
              <YStack
                padding="$3"
                borderRadius="$4"
                backgroundColor="$glassFill"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <Text color="$color11">⚠️ {item.usage_notes}</Text>
              </YStack>
            ) : null}
          </YStack>

          {/* Sticky tabs bar */}
          <YStack
            paddingHorizontal="$4"
            paddingBottom="$2"
            paddingTop="$2"
            backgroundColor="$background"
            borderBottomWidth={1}
            borderColor="$borderColor"
          >
            <GradientTabs tabs={TABS} value={tab} onChange={(k) => scrollToSection(k as TabKey)} />
          </YStack>

          {/* Sections */}
          <YStack padding="$4" gap="$5">
            {/* Meaning anchor */}
            <YStack
              onLayout={(e) => {
                sectionY.current.meaning = e.nativeEvent.layout.y;
              }}
            >
              <MeaningSection item={item} senses={senses} forms={forms} tags={tags} progress={progress} />
            </YStack>

            <Separator />

            {/* Examples anchor */}
            <YStack
              onLayout={(e) => {
                sectionY.current.examples = e.nativeEvent.layout.y;
              }}
            >
              <ExamplesSection senses={senses} examplesBySense={examplesBySense} />
            </YStack>

            <Separator />

            {/* Resources anchor */}
            <YStack
              onLayout={(e) => {
                sectionY.current.resources = e.nativeEvent.layout.y;
              }}
            >
              <ResourcesSection resources={resources} />
            </YStack>
          </YStack>
        </ScrollView>
      </YStack>
    </Screen>
  );
}

function MeaningSection({
  item,
  senses,
  forms,
  tags,
  progress,
}: {
  item: VocabItemRow;
  senses: VocabSenseRow[];
  forms: VocabFormRow[];
  tags: VocabTagRow[];
  progress: {
    addedOn: string | null;
    timesStudied: number;
    accuracyPct: number;
    stageLabel: string;
    ghostSlayed: number;
  };
}) {
  return (
    <YStack gap="$4">
      {/* Meaning / senses */}
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="900" color="$color">
          Meaning
        </Text>

        {!senses.length ? (
          <Text color="$color11">No senses yet.</Text>
        ) : (
          <YStack gap="$3">
            {senses.map((s) => (
              <YStack
                key={s.id}
                padding="$3"
                borderRadius="$5"
                backgroundColor="$glassFill"
                borderWidth={1}
                borderColor="$borderColor"
                gap="$2"
              >
                <Text fontSize="$5" fontWeight="800" color="$color">
                  Sense {s.sense_index}
                </Text>

                {s.translation ? <Text color="$color11">Translation: {s.translation}</Text> : null}
                {s.definition ? <Text color="$color11">Definition: {s.definition}</Text> : null}
                {s.grammar_hint ? <Text color="$color11">• {s.grammar_hint}</Text> : null}
                {s.usage_notes ? <Text color="$color11">• {s.usage_notes}</Text> : null}
              </YStack>
            ))}
          </YStack>
        )}
      </YStack>

      {/* Forms */}
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="900" color="$color">
          Forms
        </Text>

        {!forms.length ? (
          <Text color="$color11">No forms yet.</Text>
        ) : (
          <YStack gap="$2">
            {forms.map((f) => (
              <YStack
                key={f.id}
                padding="$3"
                borderRadius="$5"
                backgroundColor="$glassFill"
                borderWidth={1}
                borderColor="$borderColor"
                gap="$1"
              >
                <Text fontSize="$6" fontWeight="800" color="$color">
                  {f.surface_form}
                </Text>

                <Text color="$color11">
                  {[
                    f.tense ? `tense=${f.tense}` : null,
                    f.mood ? `mood=${f.mood}` : null,
                    f.person != null ? `person=${f.person}` : null,
                    f.number ? `number=${f.number}` : null,
                    f.gender ? `gender=${f.gender}` : null,
                    (f as any).case_value ? `case=${(f as any).case_value}` : null,
                    f.aspect ? `aspect=${f.aspect}` : null,
                    f.degree ? `degree=${f.degree}` : null,
                    f.is_irregular ? `irregular` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </Text>
              </YStack>
            ))}
          </YStack>
        )}
      </YStack>

      {/* Tags */}
      {tags.length ? (
        <YStack gap="$2">
          <Text fontSize="$7" fontWeight="900" color="$color">
            Tags
          </Text>
          <XStack flexWrap="wrap" gap="$2">
            {tags.map((t) => (
              <YStack
                key={t.id}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius="$4"
                backgroundColor="$glassFill"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <Text color="$color11">{t.name}</Text>
              </YStack>
            ))}
          </XStack>
        </YStack>
      ) : null}

      {/* Progress (stub) */}
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="900" color="$color">
          Progress
        </Text>

        <YStack
          padding="$3"
          borderRadius="$5"
          backgroundColor="$glassFill"
          borderWidth={1}
          borderColor="$borderColor"
          gap="$2"
        >
          <XStack justifyContent="space-between">
            <Text color="$color11">Added On</Text>
            <Text color="$color11">{progress.addedOn ? progress.addedOn.slice(0, 10) : "—"}</Text>
          </XStack>

          <XStack justifyContent="space-between">
            <Text color="$color11">Times Studied</Text>
            <Text color="$color11">{progress.timesStudied}</Text>
          </XStack>

          <XStack justifyContent="space-between">
            <Text color="$color11">Ghost Slayed</Text>
            <Text color="$color11">{progress.ghostSlayed}</Text>
          </XStack>

          <XStack justifyContent="space-between">
            <Text color="$color11">Current Stage</Text>
            <Text color="$color11">{progress.stageLabel}</Text>
          </XStack>

          <XStack justifyContent="space-between">
            <Text color="$color11">Accuracy</Text>
            <Text color="$color11">{progress.accuracyPct}%</Text>
          </XStack>
        </YStack>

        <Text color="$color11">(Stub) Later this will pull from practice attempts / mastery model.</Text>
      </YStack>
    </YStack>
  );
}

function ExamplesSection({
  senses,
  examplesBySense,
}: {
  senses: VocabSenseRow[];
  examplesBySense: Record<number, VocabExampleRow[]>;
}) {
  const flat = useMemo(() => {
    const out: Array<{ sense: VocabSenseRow; ex: VocabExampleRow }> = [];
    for (const s of senses) {
      for (const ex of examplesBySense[s.id] ?? []) out.push({ sense: s, ex });
    }
    return out;
  }, [senses, examplesBySense]);

  return (
    <YStack gap="$3">
      <Text fontSize="$7" fontWeight="900" color="$color">
        Examples
      </Text>

      {!flat.length ? (
        <Text color="$color11">No examples yet.</Text>
      ) : (
        flat.map(({ sense, ex }) => (
          <YStack
            key={ex.id}
            padding="$3"
            borderRadius="$5"
            backgroundColor="$glassFill"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$2"
          >
            <Text fontSize="$4" fontWeight="800" color="$color11">
              Sense {sense.sense_index}
            </Text>

            <Text fontSize="$6" fontWeight="800" color="$color">
              {ex.example_text}
            </Text>

            {ex.translation_text ? <Text color="$color11">{ex.translation_text}</Text> : null}
          </YStack>
        ))
      )}
    </YStack>
  );
}

function ResourcesSection({
  resources,
}: {
  resources: Array<{ id: string; title: string; subtitle?: string }>;
}) {
  return (
    <YStack gap="$3">
      <Text fontSize="$7" fontWeight="900" color="$color">
        Resources
      </Text>

      {!resources.length ? (
        <YStack gap="$2">
          <Text color="$color11">No resources yet. (Stub)</Text>
          <Text color="$color11">
            Later: add a vocab_resources table or ship resources per language pack.
          </Text>
        </YStack>
      ) : (
        resources.map((r) => (
          <YStack
            key={r.id}
            padding="$3"
            borderRadius="$5"
            backgroundColor="$glassFill"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$1"
          >
            <Text fontSize="$6" fontWeight="800" color="$color">
              {r.title}
            </Text>
            {r.subtitle ? <Text color="$color11">{r.subtitle}</Text> : null}
          </YStack>
        ))
      )}
    </YStack>
  );
}
