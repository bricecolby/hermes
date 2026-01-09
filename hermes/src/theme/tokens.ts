// src/theme/tokens.ts

export const tokens = {
  colors: {
    // Backgrounds (Hermes dark)
    bg0: "#06101C",
    bg1: "#0B1220",

    // Text
    text: "#E6EBFF",
    textMuted: "#9BA3B4",
    textFaint: "#7A8194",

    // Glass surfaces
    glassFill: "rgba(28, 37, 57, 0.3)",
    glassFillStrong: "rgba(28, 37, 57,  0.5)",
    glassOutline: "rgba(230, 235, 255, 0.12)",

    // Brand gradients
    gradA: "#1971FF",
    gradB: "#1EE6A8",

    // Inner tint gradients for “glassy gradient”
    gradTintA: "rgba(25, 113, 255, 0.14)",
    gradTintB: "rgba(30, 230, 168, 0.10)",
  },

  radius: {
    sm: 12,
    md: 16,
    lg: 22,
  },

  space: {
    xxs: 4,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
} as const;

export type Tokens = typeof tokens;
