// src/app/dev/llm.tsx
import { View, Text, Button } from "react-native";

export default function LlmDevScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>
        Local LLM Dev Screen
      </Text>
      <Button title="Run test" onPress={() => console.log("clicked")} />
    </View>
  );
}
