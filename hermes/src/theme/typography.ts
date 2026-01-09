// src/theme/typography.ts

import { Platform } from "react-native";
import { tokens } from "./tokens";

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

const fontFamily = Fonts?.sans ?? "System";

export const typography = {
  h1: {
    fontFamily,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900" as const,
    color: tokens.colors.text,
  },

  h2: {
    fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900" as const,
    color: tokens.colors.text,
  },

  title: {
    fontFamily,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800" as const,
    color: tokens.colors.text,
  },

  body: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    color: tokens.colors.text,
  },

  muted: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    color: tokens.colors.textMuted,
  },

  caption: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    color: tokens.colors.textFaint,
  },

  button: {
    fontFamily,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800" as const,
  },
} as const;

export type Typography = typeof typography;
