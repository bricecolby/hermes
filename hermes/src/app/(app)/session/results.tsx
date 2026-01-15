import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";

type ConceptResultVM = {
  conceptId: number;
  label: string;
  correct: number;
  total: number;
};

export default function Results() {
  const router = useRouter();
  const { endSession, session } = useAppState();

  /**
   * MVP STUB DATA
   * Later this will be computed from practice_attempts +
   * practice_attempt_concepts.
   */
  const summary = useMemo(() => {
    return {
      total: 5,
      correct: 4,
      xpEarned: 10,
      concepts: [
        { conceptId: 123, label: "Basic location words", correct: 3, total: 3 },
        { conceptId: 456, label: "Introducing yourself", correct: 1, total: 2 },
      ] as ConceptResultVM[],
    };
  }, []);

  const accuracy = Math.round((summary.correct / summary.total) * 100);

  const strengths = summary.concepts.filter((c) => c.correct === c.total);
  const weaknesses = summary.concepts.filter((c) => c.correct < c.total);

  return (
    <Screen>
      <Text style={styles.h1}>Session Complete</Text>

      {/* Overall performance */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Performance</Text>

        <View style={styles.row}>
          <Text style={styles.metricLabel}>Accuracy</Text>
          <Text style={styles.metricValue}>{accuracy}%</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.metricLabel}>Questions</Text>
          <Text style={styles.metricValue}>
            {summary.correct} / {summary.total}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.metricLabel}>XP earned</Text>
          <Text style={styles.metricValue}>+{summary.xpEarned}</Text>
        </View>
      </View>

      {/* What went well */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>What you did well</Text>

        {strengths.length === 0 ? (
          <Text style={styles.muted}>No concepts mastered yet — keep going.</Text>
        ) : (
          strengths.map((c) => (
            <Text key={c.conceptId} style={styles.good}>
              ✓ {c.label}
            </Text>
          ))
        )}
      </View>

      {/* Needs work */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Needs a bit more practice</Text>

        {weaknesses.length === 0 ? (
          <Text style={styles.good}>✓ No weak spots this session</Text>
        ) : (
          weaknesses.map((c) => (
            <Text key={c.conceptId} style={styles.warn}>
              • {c.label} ({c.correct}/{c.total})
            </Text>
          ))
        )}
      </View>

      {/* Next steps / Coach feedback (LLM-ready stub) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Suggested next steps</Text>

        <Text style={styles.coach}>
          Nice work overall! You’re clearly comfortable with basic location words.
          Next, spend a little more time practicing short self-introductions so they
          feel automatic.
        </Text>

        <Text style={styles.muted}>
          (In future sessions, this feedback will be personalized based on your
          mistakes and goals.)
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          endSession();
          router.replace("/(app)/home");
        }}
      >
        <Text style={styles.ctaText}>Back to Home</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },

  card: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },

  sectionTitle: {
    color: "#E6EBFF",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 4,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  metricLabel: { color: "#9BA3B4" },
  metricValue: { color: "#E6EBFF", fontWeight: "900" },

  good: { color: "#34D399", fontWeight: "700" }, 
  warn: { color: "#FBBF24", fontWeight: "700" }, 
  muted: { color: "#9BA3B4" },

  coach: {
    color: "#E6EBFF",
    fontSize: 14,
    lineHeight: 20,
  },

  cta: {
    marginTop: 20,
    backgroundColor: "#1E2A44",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: { color: "#E6EBFF", fontWeight: "900", fontSize: 15 },
});
