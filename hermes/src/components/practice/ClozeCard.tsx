import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useResponseTimer } from "@/hooks/responseTimer";

type ClozeTextPart = { type: "text"; value: string };
type ClozeBlankPart = { type: "blank"; id: string; accepted: string[]; conceptId?: number };
type ClozePart = ClozeTextPart | ClozeBlankPart;

export type ClozeFreeFillViewModel = {
  parts: ClozePart[];
  inputLanguageCode?: string;
  targetNative?: string;
};

type Props = {
  item: ClozeFreeFillViewModel;
  locked?: boolean;
  onSubmit: (payload: { responses: Record<string, string>; responseMs: number }) => void | Promise<void>;
  feedback?: { isCorrect: boolean; message?: string } | null;
};

export function ClozeCard({ item, locked = false, onSubmit, feedback }: Props) {
  const [filled, setFilled] = useState<Record<string, string>>({});
  const { reset, elapsedMs } = useResponseTimer();

  useEffect(() => {
    setFilled({});
    reset();
  }, [item.parts, reset]);

  const blankIds = useMemo(
    () => item.parts.filter((p) => p.type === "blank").map((p) => p.id),
    [item.parts]
  );

  const allFilled = useMemo(() => {
    return blankIds.every((id) => !!filled[id]?.trim());
  }, [blankIds, filled]);

  const keyboardHint = useMemo(() => {
    const code = (item.inputLanguageCode ?? "").toLowerCase();
    if (code.startsWith("ru")) return "Switch to Russian keyboard for best results.";
    return null;
  }, [item.inputLanguageCode]);

  function setBlank(id: string, word: string) {
    if (locked) return;
    setFilled((prev) => ({ ...prev, [id]: word }));
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
      {item.targetNative ? (
        <Text style={styles.targetHint}>
          Target: <Text style={styles.targetHintValue}>{item.targetNative}</Text>
        </Text>
      ) : null}

      {blankIds.map((id, i) => (
        <View key={id} style={styles.inputWrap}>
          <TextInput
            value={filled[id] ?? ""}
            editable={!locked}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="default"
            returnKeyType="done"
            placeholder={item.inputLanguageCode?.toLowerCase().startsWith("ru") ? "Введите ответ" : "Type your answer"}
            placeholderTextColor="#8A94B8"
            onChangeText={(text) => setBlank(id, text)}
            style={styles.input}
          />
        </View>
      ))}

      {keyboardHint ? <Text style={styles.hint}>{keyboardHint}</Text> : null}

      {feedback ? (
        <View
          style={[
            styles.feedbackWrap,
            feedback.isCorrect ? styles.feedbackOk : styles.feedbackBad,
          ]}
        >
          <Text style={styles.feedbackTitle}>
            {feedback.isCorrect ? "Correct" : "Incorrect"}
          </Text>
          {feedback.message ? <Text style={styles.feedbackMsg}>{feedback.message}</Text> : null}
        </View>
      ) : null}

      <TouchableOpacity
        disabled={!allFilled || locked}
        onPress={() => onSubmit({ responses: filled, responseMs: elapsedMs() })}
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
  inputWrap: {
    gap: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    color: "#E6EBFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 18,
    fontWeight: "700",
  },
  hint: {
    color: "#8A94B8",
    fontSize: 12,
    fontWeight: "600",
  },
  targetHint: {
    color: "#AFC2EA",
    fontSize: 13,
    fontWeight: "700",
    paddingLeft: 2,
    marginTop: -6,
  },
  targetHintValue: {
    color: "#00D2FF",
    fontWeight: "900",
  },
  feedbackWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  feedbackOk: {
    borderColor: "rgba(112, 219, 168, 0.7)",
    backgroundColor: "rgba(21, 58, 44, 0.55)",
  },
  feedbackBad: {
    borderColor: "rgba(255, 119, 119, 0.7)",
    backgroundColor: "rgba(77, 24, 24, 0.55)",
  },
  feedbackTitle: {
    color: "#E6EBFF",
    fontWeight: "900",
    fontSize: 14,
  },
  feedbackMsg: {
    color: "#D3D9EE",
    fontSize: 13,
    fontWeight: "600",
  },
  checkWrap: { borderRadius: 14, overflow: "hidden" },
  checkBtn: { paddingVertical: 14, alignItems: "center" },
  checkText: { color: "#06101C", fontWeight: "900", fontSize: 15 },
});
