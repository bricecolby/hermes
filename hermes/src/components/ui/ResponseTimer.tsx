import React from "react";
import { Text, View, StyleSheet } from "react-native";

export function ResponseTimer(props: { startAtMs: number; hidden?: boolean }) {
  const { startAtMs, hidden = false } = props;
  const [, force] = React.useState(0);

  React.useEffect(() => {
    if (hidden) return;
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [hidden]);

  if (hidden) return null;

  const elapsed = Math.max(0, Date.now() - startAtMs);
  const secs = (elapsed / 1000).toFixed(1);

  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{secs}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  text: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
  },
});
