import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "tamagui";

import { resolveThemeColor } from "@/components/ui/themeColor";

type Tone = "strong" | "muted";
type RGB = { r: number; g: number; b: number };

function parseColorToRgb(input: string): RGB | null {
  const s = input.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const full =
      raw.length === 3
        ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
        : raw;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  const rgb = s.match(
    /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*[0-9.]+\s*)?\)$/i,
  );
  if (!rgb) return null;

  return {
    r: Math.max(0, Math.min(255, Number(rgb[1]))),
    g: Math.max(0, Math.min(255, Number(rgb[2]))),
    b: Math.max(0, Math.min(255, Number(rgb[3]))),
  };
}

function gradientAt(a: RGB, b: RGB, t: number, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * clamped);
  const g = Math.round(a.g + (b.g - a.g) * clamped);
  const bCh = Math.round(a.b + (b.b - a.b) * clamped);
  return `rgba(${r},${g},${bCh},${alpha})`;
}

export function PillProgressRow({
  total,
  filled,
  tone = "strong",
}: {
  total: number;
  filled: number;
  tone?: Tone;
}) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const safeTotal = Math.max(0, Math.floor(total));
  const safeFilled = Math.min(Math.max(Math.floor(filled), 0), safeTotal);
  const count = safeTotal;

  const palette = useMemo(() => {
    const gradA = parseColorToRgb(resolveThemeColor(theme.gradA, "#2BCEFB")) ?? {
      r: 43,
      g: 206,
      b: 251,
    };
    const gradB = parseColorToRgb(resolveThemeColor(theme.gradB, "#2CD1AA")) ?? {
      r: 44,
      g: 209,
      b: 170,
    };
    return { gradA, gradB };
  }, [theme.gradA, theme.gradB]);

  const { gap, pillWidth, pillHeight, useSolidBar } = useMemo(() => {
    if (count <= 0) {
      return {
        gap: 0,
        pillWidth: 0,
        pillHeight: tone === "strong" ? 8 : 12,
        useSolidBar: false,
      };
    }

    const maxGap = tone === "strong" ? 3 : 6;
    const maxWidth = tone === "strong" ? 16 : 20;
    const minDiscreteWidth = 2;
    const height = tone === "strong" ? 8 : 12;
    const forceSolidBar = count > 100;

    if (forceSolidBar) {
      return { gap: 0, pillWidth: 0, pillHeight: height, useSolidBar: true };
    }

    if (trackWidth <= 0) {
      return { gap: maxGap, pillWidth: maxWidth, pillHeight: height, useSolidBar: false };
    }

    const natural = count * maxWidth + (count - 1) * maxGap;
    if (natural <= trackWidth) {
      return { gap: maxGap, pillWidth: maxWidth, pillHeight: height, useSolidBar: false };
    }

    const scale = trackWidth / natural;
    let nextGap = Math.floor(maxGap * scale);
    let nextWidth = Math.floor((trackWidth - nextGap * (count - 1)) / count);

    if (nextWidth < minDiscreteWidth) {
      nextGap = 0;
      nextWidth = Math.floor(trackWidth / count);
    }

    if (nextWidth < minDiscreteWidth) {
      return { gap: 0, pillWidth: 0, pillHeight: height, useSolidBar: true };
    }

    nextWidth = Math.min(maxWidth, nextWidth);
    return { gap: nextGap, pillWidth: nextWidth, pillHeight: height, useSolidBar: false };
  }, [count, tone, trackWidth]);

  const shownFilled =
    safeTotal <= 0 || count <= 0
      ? 0
      : Math.round((safeFilled / safeTotal) * count);

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%", overflow: "hidden" }}
    >
      {useSolidBar ? (
        <View
          style={{
            width: "100%",
            height: pillHeight,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.12)",
            borderWidth: tone === "muted" ? 1 : 0,
            borderColor: tone === "muted" ? "rgba(255,255,255,0.16)" : "transparent",
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={[
              gradientAt(palette.gradA, palette.gradB, 0, tone === "strong" ? 0.92 : 0.5),
              gradientAt(palette.gradA, palette.gradB, 1, tone === "strong" ? 0.92 : 0.5),
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              width: `${safeTotal <= 0 ? 0 : (safeFilled / safeTotal) * 100}%`,
              height: "100%",
            }}
          />
        </View>
      ) : (
        <View style={{ flexDirection: "row", width: "100%" }}>
          {Array.from({ length: count }).map((_, i) => {
            const isFilled = i < shownFilled;
            return (
              <View
                key={i}
                style={{
                  width: pillWidth,
                  height: pillHeight,
                  marginRight: i < count - 1 ? gap : 0,
                  borderRadius: tone === "strong" ? 999 : 14,
                  backgroundColor: isFilled
                    ? gradientAt(
                        palette.gradA,
                        palette.gradB,
                        shownFilled <= 1 ? 1 : i / (shownFilled - 1),
                        tone === "strong" ? 0.92 : 0.38,
                      )
                    : "rgba(255,255,255,0.12)",
                  borderWidth: tone === "muted" ? 1 : 0,
                  borderColor:
                    tone === "muted"
                      ? isFilled
                        ? gradientAt(
                            palette.gradA,
                            palette.gradB,
                            shownFilled <= 1 ? 1 : i / (shownFilled - 1),
                            0.78,
                          )
                        : "rgba(255,255,255,0.16)"
                      : "transparent",
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
