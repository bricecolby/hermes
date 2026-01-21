import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type FlashcardViewModel = {
  conceptId: number,
  front: string;
  back: string;
};

type Props = {
  item: FlashcardViewModel;
  locked?: boolean;
  onSubmit: (payload: { isCorrect: boolean }) => void | Promise<void>;
  fullScreen?: boolean;
};

const NEUTRAL_BORDER = "rgba(255,255,255,0.08)";
const CORRECT_BORDER = "rgba(34,197,94,0.85)";
const WRONG_BORDER = "rgba(251,113,133,0.85)";

export function FlashcardCard({
  item,
  locked = false,
  onSubmit,
  fullScreen = false,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [isBack, setIsBack] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;

  // 0 = front, 1 = back
  const flip = useRef(new Animated.Value(0)).current;

  const rotateZ = translateX.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  // Border shifts toward wrong/correct as you indicate a decision with swipe
  const borderColor = translateX.interpolate({
    inputRange: [-120, 0, 120],
    outputRange: [WRONG_BORDER, NEUTRAL_BORDER, CORRECT_BORDER],
    extrapolate: "clamp",
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
    translateX.setValue(0);
    flip.setValue(0);
  }, [item.front, item.back, translateX, flip]);

  function commit(isCorrect: boolean) {
    if (locked || submitted) return;
    setSubmitted(true);
    onSubmit({ isCorrect });
  }

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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12,
      onPanResponderMove: Animated.event([null, { dx: translateX }], {
        useNativeDriver: false,
      }),
        onPanResponderRelease: (_, g) => {
          if (g.dx > 120) {
            commit(true);
            Animated.timing(translateX, {
              toValue: 420,
              duration: 180,
              useNativeDriver: false,
            }).start();
          } else if (g.dx < -120) {
            commit(false);
            Animated.timing(translateX, {
              toValue: -420,
              duration: 180,
              useNativeDriver: false,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: false,
            }).start();
          }
        },
    })
  ).current;

  return (
    <View style={[styles.wrap, fullScreen && styles.wrapFull]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          fullScreen && styles.cardFull,
          {
            borderColor,
            transform: [{ translateX }, { rotate: rotateZ }],
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
          onPress={() => commit(false)}
          style={[styles.actionBtn, styles.wrong]}
        >
          <Text style={styles.actionText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={locked || submitted}
          onPress={() => commit(true)}
          style={[styles.actionBtn, styles.correct]}
        >
          <Text style={styles.actionText}>✓</Text>
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
    justifyContent: "space-between",
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
  wrong: {
    backgroundColor: "rgba(251,113,133,0.18)",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.6)",
  },
  correct: {
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.6)",
  },
  actionText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#E6EBFF",
  },
});
