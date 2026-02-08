// src/app/(app)/vocab/[id].tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { ScrollView, Separator, XStack, YStack, Text } from "tamagui";
import { useFocusEffect } from "@react-navigation/native";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { GradientTabs } from "@/components/ui/GradientTabs";
import { useAppState } from "@/state/AppState";

import { Pencil } from "@tamagui/lucide-icons";

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
import { getConceptMetaByRef } from "@/db/queries/concepts";
import { ConceptProgress } from "@/components/ui/ConceptProgress";

type TabKey = "meaning" | "examples" | "resources";

const TABS: { key: TabKey; label: string }[] = [
  { key: "meaning", label: "Meaning" },
  { key: "examples", label: "Examples" },
  { key: "resources", label: "Resources" },
];

export default function VocabDetailScreen() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeProfileId } = useAppState();

  const params = useLocalSearchParams<{ id?: string }>();
  const vocabItemId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);

  const [item, setItem] = useState<VocabItemRow | null>(null);
  const [senses, setSenses] = useState<VocabSenseRow[]>([]);
  const [forms, setForms] = useState<VocabFormRow[]>([]);
  const [tags, setTags] = useState<VocabTagRow[]>([]);
  const [examplesBySense, setExamplesBySense] = useState<Record<number, VocabExampleRow[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [conceptId, setConceptId] = useState<number | null>(null);
  const [conceptCreatedAt, setConceptCreatedAt] = useState<string | null>(null);

  const sense1 = senses.find((s) => s.sense_index === 1) ?? null;
  const loadSeq = useRef(0)

  const [tab, setTab] = useState<TabKey>("meaning");
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<TabKey, number>>>({});

  const scrollToSection = (key: TabKey) => {
    const y = sectionY.current[key];
    if (y == null) return;
    setTab(key);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  const load = useCallback(async (opts?: { reset?: boolean }) => {
    if (!Number.isFinite(vocabItemId)) return;

    const seq = ++loadSeq.current; // each call gets a unique id
    const reset = opts?.reset ?? true;

    setLoading(true);

    if (reset) {
      setItem(null);
      setSenses([]);
      setForms([]);
      setTags([]);
      setExamplesBySense({});
    }

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

      const conceptMeta = await getConceptMetaByRef(db, { kind: "vocab_item", refId: vocabItemId });

      const exMap: Record<number, VocabExampleRow[]> = {};
      for (const [senseId, ex] of exPairs) exMap[senseId] = ex;

      if (seq !== loadSeq.current) return;

      setItem(it ?? null);
      setSenses(ss);
      setForms(ff);
      setTags(tg);
      setExamplesBySense(exMap);
      setConceptId(conceptMeta?.conceptId ?? null);
      setConceptCreatedAt(conceptMeta?.createdAt ?? null);
      setLoading(false);

      mark("done");
    } catch (e: any) {
      console.error("[vocab detail] load failed", e);
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [db, vocabItemId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load({ reset: false });
    }, [load])
  )


  const primaryTranslation = useMemo(() => {
    const first = senses[0];
    return first?.definition ?? null;
  }, [senses]);

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
          <YStack padding="$4" paddingBottom="$2" gap="$2">
            <XStack alignItems="center" justifyContent="space-between" paddingRight="$5">
              <AppHeader title="Vocab Info" />

              <TouchableOpacity 
              onPress={() => router.push({ 
                pathname: "/(modals)/vocab/edit", 
                params: { id: String(vocabItemId) },
              }) 
              } activeOpacity={0.7}>
                <Pencil size={18} color="$color4" />
              </TouchableOpacity>
            </XStack>


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
              <MeaningSection
                item={item}
                senses={senses}
                forms={forms}
              />
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

            <Separator />

            <ProgressSection
              db={db}
              userId={activeProfileId ?? null}
              conceptId={conceptId}
              addedOn={conceptCreatedAt ?? item?.created_at ?? null}
            />

            <Separator />

            <TagsSection tags={tags} />
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
}: {
  item: VocabItemRow;
  senses: VocabSenseRow[];
  forms: VocabFormRow[];
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
          <YStack
            padding="$3"
            borderRadius="$5"
            backgroundColor="$glassFill"
            borderWidth={1}
            borderColor="$borderColor"
            gap="$3"
          >
            <Text fontSize="$5" fontWeight="800" color="$color">
              {item.part_of_speech}
            </Text>

            {senses.map((s, idx) => (
              <YStack
                key={s.id}
                gap="$1.5"
                paddingTop={idx === 0 ? "$0" : "$2"}
                borderTopWidth={idx === 0 ? 0 : 1}
                borderColor="$borderColor"
              >
                <XStack gap="$2" alignItems="flex-start">
                  <Text color="$color" fontWeight="800">
                    {s.sense_index}.
                  </Text>
                  <Text color="$color11" flex={1}>
                    {s.definition ?? "—"}
                  </Text>
                </XStack>
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
          <FormsTable partOfSpeech={item.part_of_speech} forms={forms} />
        )}
      </YStack>
    </YStack>
  );
}

function ProgressSection({
  db,
  userId,
  conceptId,
  addedOn,
}: {
  db: SQLite.SQLiteDatabase;
  userId: number | null;
  conceptId: number | null;
  addedOn: string | null;
}) {
  if (conceptId && userId) {
    return (
      <ConceptProgress
        db={db}
        userId={userId}
        conceptId={conceptId}
        addedOn={addedOn}
      />
    );
  }

  return (
    <YStack gap="$2">
      <Text fontSize="$7" fontWeight="900" color="$color">
        Progress
      </Text>
      <Text color="$color11">No progress data yet.</Text>
    </YStack>
  );
}

function TagsSection({ tags }: { tags: VocabTagRow[] }) {
  if (!tags.length) return null;

  return (
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
  );
}

function getCaseValue(f: VocabFormRow): string | null {
  return (f as any).case_value ?? (f as any).case ?? null;
}

function TableCell({
  value,
  header,
  align = "left",
}: {
  value: string | null;
  header?: boolean;
  align?: "left" | "center" | "right";
}) {
  return (
    <YStack
      minWidth={110}
      paddingVertical="$2"
      paddingHorizontal="$2"
      borderRightWidth={1}
      borderColor="$borderColor"
      backgroundColor={header ? "$glassFill" : "transparent"}
    >
      <Text
        color={header ? "$color" : "$color11"}
        fontWeight={header ? "900" : "700"}
        textAlign={align}
      >
        {value ?? "—"}
      </Text>
    </YStack>
  );
}

function TableRow({
  cells,
  header,
}: {
  cells: Array<string | null>;
  header?: boolean;
}) {
  return (
    <XStack borderBottomWidth={1} borderColor="$borderColor">
      {cells.map((c, i) => (
        <TableCell key={i} value={c} header={header} />
      ))}
    </XStack>
  );
}

function TableBlock({
  title,
  header,
  rows,
}: {
  title?: string;
  header: string[];
  rows: Array<Array<string | null>>;
}) {
  return (
    <YStack gap="$2">
      {title ? (
        <Text fontSize="$5" fontWeight="800" color="$color">
          {title}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <YStack
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$5"
          overflow="hidden"
        >
          <TableRow cells={header} header />
          {rows.map((r, i) => (
            <TableRow key={i} cells={r} />
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function FormsTable({
  partOfSpeech,
  forms,
}: {
  partOfSpeech: string;
  forms: VocabFormRow[];
}) {
  const pos = partOfSpeech.toLowerCase();
  const isVerb = pos === "verb";
  const isAdjective = pos === "adjective";

  if (isVerb) {
    return <VerbFormsTable forms={forms} />;
  }

  if (isAdjective) {
    return <AdjectiveNominativeTable forms={forms} />;
  }

  const hasCase = forms.some((f) => !!getCaseValue(f) && f.number);
  if (hasCase) {
    return <DeclensionTable forms={forms} />;
  }

  return (
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
              getCaseValue(f) ? `case=${getCaseValue(f)}` : null,
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
  );
}

function VerbFormsTable({ forms }: { forms: VocabFormRow[] }) {
  const aspects = Array.from(new Set(forms.map((f) => f.aspect).filter(Boolean))) as string[];
  const aspectOrder = aspects.length > 1 ? aspects : [aspects[0] ?? "base"];

  return (
    <YStack gap="$3">
      {aspectOrder.map((aspect) => {
        const scoped = aspect === "base" ? forms : forms.filter((f) => f.aspect === aspect);
        const label =
          aspect === "impf"
            ? "Imperfective"
            : aspect === "pf"
              ? "Perfective"
              : null;

        return (
          <YStack key={aspect} gap="$3">
            {label ? (
              <Text fontSize="$5" fontWeight="800" color="$color">
                {label}
              </Text>
            ) : null}

            {buildPresentTable(scoped)}
            {buildPastTable(scoped)}
            {buildFutureTable(scoped)}
            {buildImperativeTable(scoped)}

            {buildOtherForms(scoped)}
          </YStack>
        );
      })}
    </YStack>
  );
}

function buildPresentTable(forms: VocabFormRow[]) {
  const rows = [
    ["1-е лицо", formBy(forms, { tense: "pres", mood: "ind", person: 1, number: "sg" }), formBy(forms, { tense: "pres", mood: "ind", person: 1, number: "pl" })],
    ["2-е лицо", formBy(forms, { tense: "pres", mood: "ind", person: 2, number: "sg" }), formBy(forms, { tense: "pres", mood: "ind", person: 2, number: "pl" })],
    ["3-е лицо", formBy(forms, { tense: "pres", mood: "ind", person: 3, number: "sg" }), formBy(forms, { tense: "pres", mood: "ind", person: 3, number: "pl" })],
  ];

  if (!rows.some((r) => r[1] || r[2])) return null;

  return (
    <TableBlock
      title="Present"
      header={["", "ед. ч.", "мн. ч."]}
      rows={rows}
    />
  );
}

function buildFutureTable(forms: VocabFormRow[]) {
  const rows = [
    ["1-е лицо", formBy(forms, { tense: "fut", mood: "ind", person: 1, number: "sg" }), formBy(forms, { tense: "fut", mood: "ind", person: 1, number: "pl" })],
    ["2-е лицо", formBy(forms, { tense: "fut", mood: "ind", person: 2, number: "sg" }), formBy(forms, { tense: "fut", mood: "ind", person: 2, number: "pl" })],
    ["3-е лицо", formBy(forms, { tense: "fut", mood: "ind", person: 3, number: "sg" }), formBy(forms, { tense: "fut", mood: "ind", person: 3, number: "pl" })],
  ];

  if (!rows.some((r) => r[1] || r[2])) return null;

  return (
    <TableBlock
      title="Future"
      header={["", "ед. ч.", "мн. ч."]}
      rows={rows}
    />
  );
}

function buildPastTable(forms: VocabFormRow[]) {
  const rows = [
    ["м. р.", formBy(forms, { tense: "past", mood: "ind", gender: "m", number: "sg" }), null],
    ["ж. р.", formBy(forms, { tense: "past", mood: "ind", gender: "f", number: "sg" }), null],
    ["с. р.", formBy(forms, { tense: "past", mood: "ind", gender: "n", number: "sg" }), null],
    ["мн. ч.", null, formBy(forms, { tense: "past", mood: "ind", number: "pl" })],
  ];

  if (!rows.some((r) => r[1] || r[2])) return null;

  return (
    <TableBlock
      title="Past"
      header={["", "ед. ч.", "мн. ч."]}
      rows={rows}
    />
  );
}

function buildImperativeTable(forms: VocabFormRow[]) {
  const rows = [
    ["2-е лицо", formBy(forms, { mood: "imp", number: "sg" }), formBy(forms, { mood: "imp", number: "pl" })],
  ];

  if (!rows.some((r) => r[1] || r[2])) return null;

  return (
    <TableBlock
      title="Imperative"
      header={["", "ед. ч.", "мн. ч."]}
      rows={rows}
    />
  );
}

function buildOtherForms(forms: VocabFormRow[]) {
  const known = new Set<string>();
  for (const f of forms) {
    if (f.mood === "ind" && (f.tense === "pres" || f.tense === "past" || f.tense === "fut")) {
      known.add(String(f.id));
    }
    if (f.mood === "imp") {
      known.add(String(f.id));
    }
  }

  return null;
}

function DeclensionTable({ forms }: { forms: VocabFormRow[] }) {
  const cases = [
    { key: "nom", label: "Им." },
    { key: "gen", label: "Р." },
    { key: "dat", label: "Д." },
    { key: "acc", label: "В." },
    { key: "ins", label: "Тв." },
    { key: "loc", label: "Пр." },
  ];

  const rows: Array<Array<string | null>> = cases.map((c) => [
    c.label,
    declForm(forms, c.key, "sg"),
    declForm(forms, c.key, "pl"),
  ]);

  return <TableBlock header={["падеж", "ед. ч.", "мн. ч."]} rows={rows} />;
}

function AdjectiveNominativeTable({ forms }: { forms: VocabFormRow[] }) {
  const header = ["падеж", "ед. ч.", "мн. ч."];
  const nomSg = [
    adjCaseForm(forms, "nom", "sg", "m"),
    adjCaseForm(forms, "nom", "sg", "f"),
    adjCaseForm(forms, "nom", "sg", "n"),
  ]
    .filter(Boolean)
    .join("\n");

  const nomPl = adjCaseForm(forms, "nom", "pl");

  const rows: Array<Array<string | null>> = [
    ["Им.", nomSg || null, nomPl],
    ["Р.", adjCaseForm(forms, "gen", "sg", "m"), adjCaseForm(forms, "gen", "pl")],
    ["Д.", adjCaseForm(forms, "dat", "sg", "m"), adjCaseForm(forms, "dat", "pl")],
    ["В.", adjCaseForm(forms, "acc", "sg", "m"), adjCaseForm(forms, "acc", "pl")],
    ["Тв.", adjCaseForm(forms, "ins", "sg", "m"), adjCaseForm(forms, "ins", "pl")],
    ["Пр.", adjCaseForm(forms, "loc", "sg", "m"), adjCaseForm(forms, "loc", "pl")],
  ];

  return <TableBlock header={header} rows={rows} />;
}

function adjCaseForm(
  forms: VocabFormRow[],
  caseKey: string,
  number: "sg" | "pl",
  gender?: string
) {
  const f = forms.find((row) => {
    if (getCaseValue(row) !== caseKey) return false;
    if (number === "pl") return row.number === "pl";
    return row.number === "sg" && row.gender === (gender ?? "m");
  });
  return f?.surface_form ?? null;
}

function formBy(
  forms: VocabFormRow[],
  criteria: {
    tense?: string;
    mood?: string;
    person?: number;
    number?: string;
    gender?: string;
  }
): string | null {
  const f = forms.find((row) => {
    if (criteria.tense != null && row.tense !== criteria.tense) return false;
    if (criteria.mood != null && row.mood !== criteria.mood) return false;
    if (criteria.person != null && row.person !== criteria.person) return false;
    if (criteria.number != null && row.number !== criteria.number) return false;
    if (criteria.gender != null && row.gender !== criteria.gender) return false;
    return true;
  });
  return f?.surface_form ?? null;
}

function declForm(forms: VocabFormRow[], caseKey: string, number: "sg" | "pl") {
  const options =
    number === "sg"
      ? ["m", "f", "n", null]
      : [null];

  for (const g of options) {
    const f = forms.find((row) => {
      return (
        getCaseValue(row) === caseKey &&
        row.number === number &&
        (g === null ? true : row.gender === g)
      );
    });
    if (f) return f.surface_form;
  }

  return null;
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
            <Text fontSize="$2" fontWeight="800" color="$color11">
              Sense {sense.sense_index}
            </Text>

            <Text fontSize="$4" fontWeight="800" color="$color">
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
