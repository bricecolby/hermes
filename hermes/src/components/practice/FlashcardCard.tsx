import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useResponseTimer } from "@/hooks/responseTimer";
import { ResponseTimer } from "@/components/ui/ResponseTimer";

export type FlashcardViewModel = {
  conceptId: number,
  front: string;
  back: string;
};

export type FlashcardMasteryOutcome =
  | "success_easy"
  | "success_hard"
  | "failure"
  | "forgot";

type Props = {
  item: FlashcardViewModel;
  locked?: boolean;
  onSubmit: (payload: {
    isCorrect: boolean;
    responseMs: number;
    masteryOutcome: FlashcardMasteryOutcome;
  }) => void | Promise<void>;
  fullScreen?: boolean;
  showTimer?: boolean;
};

const NEUTRAL_BORDER = "rgba(255,255,255,0.08)";
const CORRECT_BORDER = "rgba(34,197,94,0.85)";
const FAIL_BORDER = "rgba(250,204,21,0.9)";
const EASY_BORDER = "rgba(96,165,250,0.9)";
const FORGOT_BORDER = "rgba(251,113,133,0.9)";

export function FlashcardCard({
  item,
  locked = false,
  onSubmit,
  fullScreen = false,
  showTimer = false,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [isBack, setIsBack] = useState(false);
  const [swipeBorderColor, setSwipeBorderColor] = useState(NEUTRAL_BORDER);

  const { reset, elapsedMs, startAtMs } = useResponseTimer();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // 0 = front, 1 = back
  const flip = useRef(new Animated.Value(0)).current;

  const rotateZ = translateX.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  // 3D flip (front/back faces)
  const frontRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  // Crossfade around the half-turn so text doesn't "mirror" mid-flip
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.49, 0.51, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.49, 0.51, 1],
    outputRange: [0, 0, 1, 1],
  });

  useEffect(() => {
    setSubmitted(false);
    setIsBack(false);
    setSwipeBorderColor(NEUTRAL_BORDER);
    translateX.setValue(0);
    translateY.setValue(0);
    flip.setValue(0);
    reset();
  }, [item.conceptId, translateX, translateY, flip, reset]);

  const commit = useCallback(
    (outcome: FlashcardMasteryOutcome) => {
      if (locked || submitted) return;
      setSubmitted(true);
      const responseMs = elapsedMs();
      const isCorrect = outcome === "success_easy" || outcome === "success_hard";
      onSubmit({ isCorrect, responseMs, masteryOutcome: outcome });
    },
    [elapsedMs, locked, onSubmit, submitted]
  );

  function toggleFlip() {
    if (locked || submitted) return;

    const next = !isBack;
    setIsBack(next);

    Animated.timing(flip, {
      toValue: next ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !locked && !submitted && (Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12),
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
        translateY.setValue(g.dy);

        const absDx = Math.abs(g.dx);
        const absDy = Math.abs(g.dy);
        const nextColor =
          absDx < 18 && absDy < 18
            ? NEUTRAL_BORDER
            : absDx >= absDy
              ? g.dx >= 0
                ? CORRECT_BORDER
                : FAIL_BORDER
              : g.dy < 0
                ? EASY_BORDER
                : FORGOT_BORDER;
        setSwipeBorderColor(nextColor);
      },
        onPanResponderRelease: (_, g) => {
          const absDx = Math.abs(g.dx);
          const absDy = Math.abs(g.dy);
          const horizontal = absDx >= absDy;

          if (horizontal && g.dx > 120) {
            setSwipeBorderColor(CORRECT_BORDER);
            commit("success_hard");
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: 420,
                duration: 180,
                useNativeDriver: false,
              }),
              Animated.timing(translateY, {
                toValue: 0,
                duration: 180,
                useNativeDriver: false,
              }),
            ]).start();
          } else if (horizontal && g.dx < -120) {
            setSwipeBorderColor(FAIL_BORDER);
            commit("failure");
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: -420,
                duration: 180,
                useNativeDriver: false,
              }),
              Animated.timing(translateY, {
                toValue: 0,
                duration: 180,
                useNativeDriver: false,
              }),
            ]).start();
          } else if (!horizontal && g.dy < -100) {
            setSwipeBorderColor(EASY_BORDER);
            commit("success_easy");
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: 0,
                duration: 180,
                useNativeDriver: false,
              }),
              Animated.timing(translateY, {
                toValue: -420,
                duration: 180,
                useNativeDriver: false,
              }),
            ]).start();
          } else if (!horizontal && g.dy > 100) {
            setSwipeBorderColor(FORGOT_BORDER);
            commit("forgot");
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: 0,
                duration: 180,
                useNativeDriver: false,
              }),
              Animated.timing(translateY, {
                toValue: 420,
                duration: 180,
                useNativeDriver: false,
              }),
            ]).start();
          } else {
            setSwipeBorderColor(NEUTRAL_BORDER);
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: false,
              }),
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: false,
              }),
            ]).start();
          }
        },
        onPanResponderTerminate: () => {
          setSwipeBorderColor(NEUTRAL_BORDER);
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: false,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: false,
            }),
          ]).start();
        },
      }),
    [commit, locked, submitted, translateX, translateY]
  );

  return (
    <View style={[styles.wrap, fullScreen && styles.wrapFull]}>
      {showTimer ? <ResponseTimer startAtMs={startAtMs()} /> : null}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          fullScreen && styles.cardFull,
          {
            borderColor: swipeBorderColor,
            transform: [{ translateX }, { translateY }, { rotate: rotateZ }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={toggleFlip}
          style={{ flex: 1, justifyContent: "center" }}
        >
          <View style={styles.flipStage}>
            <Animated.View
              style={[
                styles.face,
                {
                  opacity: frontOpacity,
                  transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
                },
              ]}
            >
              <Text style={styles.mainText}>{item.front}</Text>
              <Text style={styles.hint}>Tap to reveal</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.face,
                styles.backFace,
                {
                  opacity: backOpacity,
                  transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
                },
              ]}
            >
              <Text style={styles.mainText}>{item.back}</Text>
              <Text style={styles.hint}>Tap to see front</Text>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <View style={[styles.actions, fullScreen && styles.actionsFull]}>
        <TouchableOpacity
          disabled={locked || submitted}
          onPress={() => commit("forgot")}
          style={[styles.actionBtn, styles.forgot]}
        >
          <Text style={[styles.actionText, styles.forgotText]}>✕✕✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={locked || submitted}
          onPress={() => commit("failure")}
          style={[styles.actionBtn, styles.fail]}
        >
          <Text style={[styles.actionText, styles.failText]}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={locked || submitted}
          onPress={() => commit("success_hard")}
          style={[styles.actionBtn, styles.correct]}
        >
          <Text style={[styles.actionText, styles.correctText]}>✓</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={locked || submitted}
          onPress={() => commit("success_easy")}
          style={[styles.actionBtn, styles.easy]}
        >
          <Text style={[styles.actionText, styles.easyText]}>✓✓✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  wrapFull: { flex: 1 },

  card: {
    backgroundColor: "#0B1220",
    borderRadius: 20,
    padding: 22,
    minHeight: 220,
    borderWidth: 2, // a little thicker so the color shift reads better
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardFull: {
    flex: 1,
    minHeight: undefined,
    justifyContent: "center",
  },

  flipStage: {
    flex: 1,
    justifyContent: "center",
  },
  face: {
    backfaceVisibility: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  backFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  mainText: {
    color: "#E6EBFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  hint: {
    marginTop: 12,
    color: "#9BA3B4",
    textAlign: "center",
    fontWeight: "600",
  },

  actions: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  actionsFull: {
    paddingBottom: 6,
  },

  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  fail: {
    backgroundColor: "rgba(250,204,21,0.18)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.6)",
  },
  correct: {
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.6)",
  },
  easy: {
    backgroundColor: "rgba(96,165,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.6)",
  },
  forgot: {
    backgroundColor: "rgba(251,113,133,0.18)",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.6)",
  },
  actionText: {
    fontSize: 20,
    fontWeight: "900",
  },
  failText: {
    color: "rgba(250,204,21,0.95)",
  },
  correctText: {
    color: "rgba(34,197,94,0.95)",
  },
  easyText: {
    color: "rgba(96,165,250,0.95)",
  },
  forgotText: {
    color: "rgba(251,113,133,0.95)",
  },
});
