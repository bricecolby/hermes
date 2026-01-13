import React, { useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { ScrollView, Separator, XStack, YStack, Text } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { GradientTabs } from "@/components/ui/GradientTabs";

import {
  getGrammarPoint,
  listExamplesForGrammarPoint,
  listTagsForGrammarPoint,
  listVocabLinksForGrammarPoint,
  type GrammarPointRow,
  type GrammarExampleRow,
  type GrammarTagRow,
  type VocabGrammarLinkRow,
} from "@/db/queries/grammar";

type TabKey = "meaning" | "examples" | "resources";

const TABS: { key: TabKey; label: string }[] = [
  { key: "meaning", label: "Meaning" },
  { key: "examples", label: "Examples" },
  { key: "resources", label: "Resources" },
];

export default function GrammarPointDetailScreen() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();

  const params = useLocalSearchParams<{ id?: string }>();
  const grammarPointId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [gp, setGp] = useState<GrammarPointRow | null>(null);
  const [examples, setExamples] = useState<GrammarExampleRow[]>([]);
  const [tags, setTags] = useState<GrammarTagRow[]>([]);
  const [vocabLinks, setVocabLinks] = useState<VocabGrammarLinkRow[]>([]);

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
      if (!Number.isFinite(grammarPointId)) return;

      setLoading(true);

      const point = await getGrammarPoint(db, grammarPointId);
      const ex = await listExamplesForGrammarPoint(db, grammarPointId);
      const tg = await listTagsForGrammarPoint(db, grammarPointId);
      const links = await listVocabLinksForGrammarPoint(db, grammarPointId);

      if (!cancelled) {
        setGp(point ?? null);
        setExamples(ex);
        setTags(tg);
        setVocabLinks(links);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [db, grammarPointId]);

  const progress = useMemo(() => {
    return {
      addedOn: gp?.created_at ?? null,
      timesStudied: 0,
      accuracyPct: 0,
      stageLabel: "Novice",
      ghostSlayed: 0,
    };
  }, [gp]);

  const resources = useMemo(() => {
    return [] as Array<{ id: string; title: string; subtitle?: string }>;
  }, []);

  if (!Number.isFinite(grammarPointId)) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
          <AppHeader title="Grammar" />
          <Text color="$color11">Invalid grammar point id.</Text>
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

  if (!gp) {
    return (
      <Screen noPad>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
          <AppHeader title="Grammar" />
          <Text fontSize="$7" fontWeight="800" color="$color">
            Not found
          </Text>
          <Text color="$color11">This grammar point doesn’t exist (or isn’t seeded).</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text color="$color" textDecorationLine="underline">
              Go back
            </Text>
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

          <YStack padding="$4" paddingBottom="$2" gap="$2">
            <AppHeader title="Grammar Info" subtitle={gp.title} />

            <YStack alignItems="center" paddingVertical="$4" gap="$2">
              <Text fontSize="$8" fontWeight="900" color="$color">
                {gp.title}
              </Text>
              <Text fontSize="$6" color="$color11" textAlign="center">
                {gp.summary ?? "No summary yet."}
              </Text>
            </YStack>

            {gp.usage_notes ? (
              <YStack
                padding="$3"
                borderRadius="$4"
                backgroundColor="$glassFill"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <Text color="$color11">⚠️ {gp.usage_notes}</Text>
              </YStack>
            ) : null}
          </YStack>

          <YStack
            paddingHorizontal="$4"
            paddingBottom="$2"
            paddingTop="$2"
            backgroundColor="$background"
            borderBottomWidth={1}
            borderColor="$borderColor"
          >
            <GradientTabs
              tabs={TABS}
              value={tab}
              onChange={(k) => scrollToSection(k as TabKey)}
            />
          </YStack>

          <YStack padding="$4" gap="$5">
            {/* Meaning anchor */}
            <YStack
              onLayout={(e) => {
                sectionY.current.meaning = e.nativeEvent.layout.y;
              }}
            >
              <MeaningSection gp={gp} tags={tags} progress={progress} vocabLinks={vocabLinks} />
            </YStack>

            <Separator />

            {/* Examples anchor */}
            <YStack
              onLayout={(e) => {
                sectionY.current.examples = e.nativeEvent.layout.y;
              }}
            >
              <ExamplesSection examples={examples} />
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
  gp,
  tags,
  progress,
  vocabLinks,
}: {
  gp: GrammarPointRow;
  tags: GrammarTagRow[];
  progress: {
    addedOn: string | null;
    timesStudied: number;
    accuracyPct: number;
    stageLabel: string;
    ghostSlayed: number;
  };
  vocabLinks: VocabGrammarLinkRow[];
}) {
  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="900" color="$color">
          Meaning
        </Text>
        <Text color="$color11" lineHeight="$5">
          {gp.explanation ?? "No explanation yet."}
        </Text>
      </YStack>

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

      {vocabLinks.length ? (
        <YStack gap="$2">
          <Text fontSize="$7" fontWeight="900" color="$color">
            Linked Vocab
          </Text>
          <Text color="$color11">
            {vocabLinks.length} link(s) found. (Stub) Later: join to vocab tables to show actual
            words/senses/forms.
          </Text>
        </YStack>
      ) : null}
    </YStack>
  );
}

function ExamplesSection({ examples }: { examples: GrammarExampleRow[] }) {
  return (
    <YStack gap="$3">
      <Text fontSize="$7" fontWeight="900" color="$color">
        Examples
      </Text>

      {!examples.length ? (
        <Text color="$color11">No examples yet.</Text>
      ) : (
        examples.map((ex) => (
          <YStack
            key={ex.id}
            padding="$3"
            borderRadius="$5"
            backgroundColor="$glassFill"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$2"
          >
            <Text fontSize="$6" fontWeight="800" color="$color">
              {ex.example_text}
            </Text>
            {ex.translation_text ? <Text color="$color11">{ex.translation_text}</Text> : null}
            {ex.notes ? <Text color="$color11">• {ex.notes}</Text> : null}
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
            Later: add a grammar_resources table or ship resources per language pack.
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
