import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type FlashcardViewModel = {
  front: string;
  back: string;
};


type Props = {
  item: FlashcardViewModel;
  locked?: boolean;
  onSubmit: (payload: { isCorrect: boolean }) => void | Promise<void>;
};

export function FlashcardCard({ item, locked = false, onSubmit }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  useEffect(() => {
    setFlipped(false);
    setSubmitted(false);
    translateX.setValue(0);
  }, [item.front, item.back, translateX]);

  function commit(isCorrect: boolean) {
    if (locked || submitted) return;
    setSubmitted(true);
    onSubmit({ isCorrect });
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12,
      onPanResponderMove: Animated.event(
        [null, { dx: translateX }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 120) {
          Animated.timing(translateX, {
            toValue: 420,
            duration: 180,
            useNativeDriver: true,
          }).start(() => commit(true));
        } else if (g.dx < -120) {
          Animated.timing(translateX, {
            toValue: -420,
            duration: 180,
            useNativeDriver: true,
          }).start(() => commit(false));
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          { transform: [{ translateX }, { rotate }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setFlipped((f) => !f)}
          style={{ flex: 1, justifyContent: "center" }}
        >
          <Text style={styles.mainText}>
            {flipped ? item.back : item.front}
          </Text>
          <Text style={styles.hint}>
            {flipped ? "Tap to see front" : "Tap to reveal"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.actions}>
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
  card: {
    backgroundColor: "#0B1220",
    borderRadius: 20,
    padding: 22,
    minHeight: 220,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
