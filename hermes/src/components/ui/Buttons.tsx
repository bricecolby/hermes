import React from "react";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, useTheme } from "tamagui";
import { resolveThemeColor } from "./themeColor";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function HermesButton({ label, onPress, disabled, variant = "primary" }: Props) {
  const theme = useTheme();
  const gradA = resolveThemeColor(theme.gradA, "#1971FF");
  const gradB = resolveThemeColor(theme.gradB, "#1EE6A8");
  const outline = resolveThemeColor(theme.glassOutline, "rgba(230, 235, 255, 0.12)");
  const fill = resolveThemeColor(theme.glassFill, "rgba(70, 90, 129, 0.55)");

  if (variant === "primary") {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        disabled={disabled}
        style={{ marginTop: 18, opacity: disabled ? 0.55 : 1 }}
      >
        <LinearGradient
          colors={[gradA, gradB]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 14, padding: 1.6 }}
        >
          <LinearGradient
            colors={["rgba(6, 16, 28, 0.75)", "rgba(6, 16, 28, 0.45)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 12.4, paddingVertical: 14, alignItems: "center" }}
          >
            <Text color="$color" fontWeight="900" fontSize={15}>
              {label}
            </Text>
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={{
        marginTop: 18,
        opacity: disabled ? 0.55 : 1,
        backgroundColor: fill,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: outline,
      }}
    >
      <Text color="$color" fontWeight="900" fontSize={15}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
