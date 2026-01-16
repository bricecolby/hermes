import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type ClozeTextPart = { type: "text"; value: string };
type ClozeBlankPart = { type: "blank"; id: string; accepted: string[]; conceptId?: number };
type ClozePart = ClozeTextPart | ClozeBlankPart;

export type ClozeFreeFillViewModel = {
  parts: ClozePart[];
};

type Props = {
  item: ClozeFreeFillViewModel;
  locked?: boolean;
  onSubmit: (payload: { responses: Record<string, string> }) => void | Promise<void>;
  feedback?: { isCorrect: boolean } | null;
};

export function ClozeCard({ item, locked = false, onSubmit }: Props) {
  const [filled, setFilled] = useState<Record<string, string>>({});

  useEffect(() => {
    setFilled({});
  }, [item.parts]);

  const wordBank = useMemo(() => {
    const all = item.parts.flatMap((p) => (p.type === "blank" ? p.accepted : []));
    return Array.from(new Set(all));
  }, [item.parts]);

  const allFilled = useMemo(() => {
    const ids = item.parts.filter((p) => p.type === "blank").map((p) => p.id);
    return ids.every((id) => !!filled[id]?.trim());
  }, [item.parts, filled]);

  function setBlank(id: string, word: string) {
    if (locked) return;
    setFilled((prev) => ({ ...prev, [id]: word }));
  }

  function fillNextEmpty(word: string) {
    if (locked) return;
    const next = item.parts.find((p) => p.type === "blank" && !filled[p.id]);
    if (next && next.type === "blank") setBlank(next.id, word);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sentence}>
        {item.parts.map((p, i) =>
          p.type === "text" ? (
            <Text key={`t-${i}`}>{p.value}</Text>
          ) : (
            <Text key={p.id} style={styles.blank}>
              {filled[p.id] ?? "____"}
            </Text>
          )
        )}
      </Text>

      <View style={styles.bank}>
        {wordBank.map((w) => (
          <TouchableOpacity key={w} style={styles.word} onPress={() => fillNextEmpty(w)} disabled={locked}>
            <Text style={styles.wordText}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        disabled={!allFilled || locked}
        onPress={() => onSubmit({ responses: filled })}
        style={[styles.checkWrap, (!allFilled || locked) && { opacity: 0.5 }]}
      >
        <LinearGradient colors={["#7CC8FF", "#1971FF"]} style={styles.checkBtn}>
          <Text style={styles.checkText}>Check</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 18,
  },
  sentence: {
    color: "#E6EBFF",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 28,
  },
  blank: {
    color: "#7CC8FF",
    fontWeight: "900",
  },
  bank: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  word: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  wordText: {
    color: "#E6EBFF",
    fontWeight: "800",
  },
  checkWrap: { borderRadius: 14, overflow: "hidden" },
  checkBtn: { paddingVertical: 14, alignItems: "center" },
  checkText: { color: "#06101C", fontWeight: "900", fontSize: 15 },
});
