import { createTamagui } from "@tamagui/core";
import { config } from "@tamagui/config/v3";
import { tokens as hermesTokens } from "./tamagui.tokens";

const appConfig = createTamagui({
  ...config,

  themes: {
    ...config.themes,

    dark: {
      ...config.themes.dark,

      background: hermesTokens.colors.bg0,
      color: hermesTokens.colors.text,

      color3: hermesTokens.colors.textMuted,
      color4: hermesTokens.colors.textFaint,

      glassFill: hermesTokens.colors.glassFill,
      glassFillStrong: hermesTokens.colors.glassFillStrong,
      glassOutline: hermesTokens.colors.glassOutline,

      gradA: hermesTokens.colors.gradA,
      gradB: hermesTokens.colors.gradB,
      gradTintA: hermesTokens.colors.gradTintA,
      gradTintB: hermesTokens.colors.gradTintB,
    },
  },

  defaultTheme: "dark",
});

export default appConfig;
