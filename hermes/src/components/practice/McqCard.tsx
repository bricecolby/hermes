import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Choice = { id: string; text: string };

export type McqViewModel = {
  prompt: string;
  choices: Choice[];
  correctChoiceId: string; // for reveal styling only (driver still evaluates!)
};

export type McqSubmitPayload = {
  choiceId: string;
};

type Props = {
  item: McqViewModel;
  locked?: boolean;
  onSubmit: (payload: McqSubmitPayload) => Promise<void> | void;
  feedback?: { isCorrect: boolean; correctChoiceId: string; message: string } | null;
};

export function McqCard({ item, locked = false, onSubmit, feedback }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const reveal = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });

  const revealOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const revealY = reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  const canInteract = useMemo(() => !locked && !submitted, [locked, submitted]);

  // ✅ Critical: when the item changes, reset internal component state.
  // This prevents prior selection/submitted state from leaking into the next question.
  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
    reveal.setValue(0);
    shake.setValue(0);
  }, [item.prompt, item.correctChoiceId, item.choices, reveal, shake]);

  function runReveal() {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }

  function runShake() {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  async function handleSubmit() {
    if (!selected || locked || submitted) return;

    setSubmitted(true);
    await onSubmit({ choiceId: selected });

    runReveal();
    if (feedback && !feedback.isCorrect) runShake();
  }

  return (
    <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
      <View style={styles.card}>
        <Text style={styles.prompt}>{item.prompt}</Text>

        <View style={{ height: 12 }} />

        <View style={{ gap: 10 }}>
          {item.choices.map((c) => {
            const isSelected = selected === c.id;

            const isCorrectChoice = !!feedback && c.id === feedback.correctChoiceId;
            const isWrongSelected = !!feedback && isSelected && !feedback.isCorrect;

            const showSelected = isSelected && !feedback;
            const showCorrect = isCorrectChoice;
            const showWrong = isWrongSelected;

            const containerStyle = [
              styles.choice,
              showSelected && styles.choiceSelectedBorder,
              showCorrect && styles.choiceCorrectBorder,
              showWrong && styles.choiceWrong,
              !canInteract && styles.choiceDisabled,
            ];

            const content = (
              <>
                <Text style={styles.choiceId}>{c.id}.</Text>
                <Text style={styles.choiceText}>{c.text}</Text>
              </>
            );

            // Selected: Hermes light-blue gradient
            if (showSelected) {
              return (
                <TouchableOpacity
                  key={c.id}
                  disabled={!canInteract}
                  onPress={() => setSelected(c.id)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={["rgba(124,200,255,0.30)", "rgba(25,113,255,0.16)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={containerStyle}
                  >
                    {content}
                  </LinearGradient>
                </TouchableOpacity>
              );
            }

            // Correct: blue -> green gradient
            if (showCorrect) {
              return (
                <View key={c.id}>
                  <LinearGradient
                    colors={["rgba(25,113,255,0.22)", "rgba(34,197,94,0.22)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={containerStyle}
                  >
                    {content}
                  </LinearGradient>
                </View>
              );
            }

            // Default / Wrong:
            return (
              <TouchableOpacity
                key={c.id}
                style={containerStyle}
                disabled={!canInteract}
                onPress={() => setSelected(c.id)}
                activeOpacity={0.9}
              >
                {content}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 14 }} />

        {!submitted ? (
          <TouchableOpacity
            style={[styles.checkBtnWrap, (!selected || locked) && styles.checkBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selected || locked}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#7CC8FF", "#1971FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.checkBtn}
            >
              <Text style={styles.checkBtnText}>Check</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {feedback ? (
          <Animated.View style={{ opacity: revealOpacity, transform: [{ translateY: revealY }] }}>
            <View style={styles.feedback}>
              <Text style={styles.feedbackTitle}>{feedback.message}</Text>
              {!feedback.isCorrect ? (
                <Text style={styles.feedbackSub}>
                  Correct answer: <Text style={styles.feedbackBold}>{feedback.correctChoiceId}</Text>
                </Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  prompt: { color: "#E6EBFF", fontSize: 18, fontWeight: "900" },

  choice: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  // Borders for gradient states
  choiceSelectedBorder: {
    borderColor: "rgba(124,200,255,0.90)",
  },
  choiceCorrectBorder: {
    borderColor: "rgba(34,197,94,0.75)",
  },

  // Wrong: slightly lighter red/pink for dark theme
  choiceWrong: {
    borderColor: "rgba(251,113,133,0.78)",
    backgroundColor: "rgba(251,113,133,0.14)",
  },

  choiceDisabled: { opacity: 0.92 },

  choiceId: { color: "#9BA3B4", fontWeight: "900", width: 18 },
  choiceText: { color: "#E6EBFF", fontSize: 15, fontWeight: "700", flex: 1 },

  // Gradient button wrapper (so opacity affects whole thing)
  checkBtnWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  checkBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  checkBtnDisabled: { opacity: 0.5 },
  checkBtnText: { color: "#06101C", fontWeight: "900", fontSize: 15 },

  feedback: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  feedbackTitle: { color: "#E6EBFF", fontWeight: "900", fontSize: 16 },
  feedbackSub: { color: "#9BA3B4", marginTop: 6 },
  feedbackBold: { color: "#E6EBFF", fontWeight: "900" },
});
