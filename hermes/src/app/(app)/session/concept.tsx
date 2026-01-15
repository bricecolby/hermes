import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";

type VocabVM = {
  id: number;
  target: string;
  native: string;
};

type GrammarVM = {
  id: number;
  title: string;
  summary: string;
};

// MVP stub — replace with real DB queries
async function fetchSessionConceptsStub(conceptIds: number[]) {
  const vocab: VocabVM[] = [];
  const grammar: GrammarVM[] = [];

  conceptIds.forEach((id, i) => {
    if (i % 2 === 0) {
      vocab.push({
        id,
        target: "метро",
        native: "subway",
      });
    } else {
      grammar.push({
        id,
        title: "Word order in Russian",
        summary: "Word order is flexible and emphasis changes meaning.",
      });
    }
  });

  return { vocab, grammar };
}

export default function Concept() {
  const router = useRouter();
  const { session } = useAppState();

  const conceptIds = session?.conceptIds ?? [];

  const [loading, setLoading] = useState(true);
  const [vocab, setVocab] = useState<VocabVM[]>([]);
  const [grammar, setGrammar] = useState<GrammarVM[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { vocab, grammar } = await fetchSessionConceptsStub(conceptIds);
        setVocab(vocab);
        setGrammar(grammar);
      } finally {
        setLoading(false);
      }
    })();
  }, [conceptIds]);

  if (!session) {
    return (
      <Screen>
        <Text style={styles.h1}>Session Prep</Text>
        <Text style={styles.sub}>No active session.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.h1}>Quick Review</Text>
      <Text style={styles.sub}>
        Here’s what you’ll see in this session. Tap anything to review in more detail.
      </Text>

      {loading ? (
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {/* Vocab */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vocabulary</Text>

            {vocab.length === 0 ? (
              <Text style={styles.muted}>No new vocabulary in this session.</Text>
            ) : (
              vocab.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: "/(modals)/vocab/[id]",
                      params: {
                        id: String(v.id),
                        returnTo: "/(app)/session/concept",
                      },
                    })
                  }
                  activeOpacity={0.9}
                >
                  <Text style={styles.target}>{v.target}</Text>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={styles.native}>{v.native}</Text>
                </TouchableOpacity>

              ))
            )}
          </View>

          {/* Grammar */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Grammar</Text>

            {grammar.length === 0 ? (
              <Text style={styles.muted}>No grammar focus in this session.</Text>
            ) : (
              grammar.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.grammarRow}
                  onPress={() =>
                    router.push({
                      pathname: "/(modals)/grammar/[id]",
                      params: {
                        id: String(g.id),
                        returnTo: "/(app)/session/concept",
                      },
                    })
                  }
                  activeOpacity={0.9}
                >
                  <Text style={styles.grammarTitle}>{g.title}</Text>
                  <Text style={styles.grammarSummary}>{g.summary}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>


          {/* CTA */}
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.replace("/(app)/session/practice")}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaText}>Start Practice</Text>
          </TouchableOpacity>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 6 },

  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  sectionTitle: {
    color: "#E6EBFF",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },

  muted: { color: "#9BA3B4", marginTop: 6 },

  row: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
  },
  target: { color: "#E6EBFF", fontWeight: "900", flex: 1 },
  arrow: { color: "#7CC8FF", marginHorizontal: 10, fontWeight: "900" },
  native: { color: "#9BA3B4", flex: 1, textAlign: "right" },

  grammarRow: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  grammarTitle: { color: "#E6EBFF", fontWeight: "900" },
  grammarSummary: { color: "#9BA3B4", marginTop: 4 },

  cta: {
    marginTop: 20,
    backgroundColor: "#1E2A44",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: { color: "#E6EBFF", fontWeight: "900", fontSize: 15 },
});
