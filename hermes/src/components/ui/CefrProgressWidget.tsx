import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable } from "react-native";
import { XStack, YStack, Text, useTheme } from "tamagui";
import type { SQLiteDatabase } from "expo-sqlite";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeftRight, Ear, MessageCircle } from "lucide-react-native";

import {
  getCefrProgressByModality,
  type CefrProgressByModalityRow,
  type CefrProgressRow,
} from "../../db/queries/mastery";
import type { ProgressMode } from "../../db/queries/concepts";
import { GlassCard } from "../../components/ui/GlassCard";
import { resolveThemeColor } from "./themeColor";

type Props = {
  db: SQLiteDatabase;
  userId: number;
  languageId: number | null;
  modelKey?: string;
  refreshNonce?: number;
};

const MODES: ProgressMode[] = ["vocab", "grammar", "both"];

function nextMode(m: ProgressMode): ProgressMode {
  const idx = MODES.indexOf(m);
  return MODES[(idx + 1) % MODES.length];
}

function clampPct(n: number) {
  return Math.max(0, Math.min(1, n));
}

function subtitleForMode(mode: ProgressMode) {
  if (mode === "both") return "Grammar & Vocab";
  if (mode === "vocab") return "Vocab";
  return "Grammar";
}

export function CefrProgressWidget({ db, userId, languageId, modelKey = "ema_v1", refreshNonce }: Props) {
  const theme = useTheme();

  const [mode, setMode] = useState<ProgressMode>("both");
  const [rows, setRows] = useState<CefrProgressByModalityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!languageId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const r = await getCefrProgressByModality(db, { userId, languageId, modelKey, mode });
      setRows(r);
    } finally {
      setLoading(false);
    }
  }, [db, userId, languageId, modelKey, mode, refreshNonce]);

  useEffect(() => {
    load();
  }, [load]);

  const subtitle = subtitleForMode(mode);

  const trackColor = resolveThemeColor(
    theme.glassFillStrong ?? theme.glassFill ?? theme.background,
    "rgba(6, 16, 28, 0.55)"
  );

  const tier0 = "rgba(33, 186, 212, 0.8)";
  const tier1 =  "rgba(24, 224, 255, 0.8)"; 
  const tier2 = "rgba(121, 251, 255, 0.8)";  
  const tier3 = "rgba(175, 252, 255, 0.8)";     

  const iconBg = resolveThemeColor(theme.glassFill, "rgba(18, 26, 42, 0.70)");
  const iconOutline = resolveThemeColor(theme.glassOutline, "rgba(255,255,255,0.10)");

  const iconColor = resolveThemeColor(theme.textMuted, "rgba(240,248,255,0.78)");

  const gradA = resolveThemeColor(theme.gradA, "#2BCEFB");
  const gradB = resolveThemeColor(theme.gradB, "#2CD1AA");

  const cardBaseBg = resolveThemeColor(
    theme.background ?? theme.glassFill,
    "rgba(8, 18, 30, 1)"
  );


  return (
    <YStack marginTop={14}>

      <LinearGradient
        colors={[gradA, gradB]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          borderRadius: 18,
          padding: 1, 
        }}
      >
        <YStack
          borderRadius={18}
          padding={1}
          backgroundColor={cardBaseBg}
        >
            <GlassCard borderRadius={16} padding={14}>
            <XStack alignItems="flex-start" justifyContent="space-between">
                <YStack>
                <Text fontSize={18} fontWeight="700" color="$textMuted">
                    CEFR Progress
                </Text>
                <Text marginTop={2} fontSize={13} color="$textFaint">
                    {subtitle}
                </Text>
                </YStack>

                <Pressable
                onPress={() => setMode((m) => nextMode(m))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Toggle progress mode"
                >
                <YStack
                    width={34}
                    height={34}
                    borderRadius={999}
                    backgroundColor={iconBg}
                    alignItems="center"
                    justifyContent="center"
                    borderWidth={1}
                    borderColor={iconOutline}
                    opacity={loading ? 0.6 : 1}
                >
                    <ArrowLeftRight size={16} color={iconColor} />
                </YStack>
                </Pressable>
            </XStack>

            <YStack marginTop={12} gap={10}>
            {rows.map((r) => (
                <CefrRow
                key={r.cefr}
                row={r}
                trackColor={trackColor}
                tier0={tier0}
                tier1={tier1}
                tier2={tier2}
                tier3={tier3}
                iconColor={iconColor}
                />
            ))}
            </YStack>
            </GlassCard>
        </YStack>
      </LinearGradient>
    </YStack>
  );
}

function CefrRow({
  row,
  trackColor,
  tier0,
  tier1,
  tier2,
  tier3,
  iconColor,
}: {
  row: CefrProgressByModalityRow;
  trackColor: string;
  tier0: string;
  tier1: string;
  tier2: string;
  tier3: string;
  iconColor: string;
}) {
  return (
    <XStack alignItems="center" gap={8}>
      <Text width={32} fontSize={16} fontWeight="700" color="$textMuted">
        {row.cefr.replace("CEFR:", "")}
      </Text>

      <YStack flex={1} gap={2}>
        <CefrMiniBar
          stats={row.reception}
          icon={Ear}
          trackColor={trackColor}
          tier0={tier0}
          tier1={tier1}
          tier2={tier2}
          tier3={tier3}
          iconColor={iconColor}
        />
        <CefrMiniBar
          stats={row.production}
          icon={MessageCircle}
          trackColor={trackColor}
          tier0={tier0}
          tier1={tier1}
          tier2={tier2}
          tier3={tier3}
          iconColor={iconColor}
        />
      </YStack>

      <YStack width={64} alignItems="flex-end" gap={2}>
        <Text textAlign="right" fontSize={12} fontWeight="700" color="$textMuted">
          {row.reception.exposed}/{row.reception.total}
        </Text>
        <Text textAlign="right" fontSize={12} fontWeight="700" color="$textMuted">
          {row.production.exposed}/{row.production.total}
        </Text>
      </YStack>
    </XStack>
  );
}

function CefrMiniBar({
  stats,
  icon: Icon,
  trackColor,
  tier0,
  tier1,
  tier2,
  tier3,
  iconColor,
}: {
  stats: CefrProgressRow;
  icon: typeof Ear;
  trackColor: string;
  tier0: string;
  tier1: string;
  tier2: string;
  tier3: string;
  iconColor: string;
}) {
  const total = stats.total || 0;

  const exposed = stats.exposed || 0;
  const mastery = stats.mastery || 0;
  const fluency = stats.fluency || 0;
  const auto = stats.automaticity || 0;

  // Enforce nesting: auto ⊆ fluency ⊆ mastery ⊆ exposed
  const autoN = Math.min(auto, fluency, mastery, exposed);
  const fluencyN = Math.min(fluency, mastery, exposed);
  const masteryN = Math.min(mastery, exposed);
  const exposedN = exposed;

  const exposedOnly = Math.max(0, exposedN - masteryN);
  const masteryOnly = Math.max(0, masteryN - fluencyN);
  const fluencyOnly = Math.max(0, fluencyN - autoN);
  const autoOnly = Math.max(0, autoN);

  const p0 = total ? clampPct(exposedOnly / total) : 0;
  const p1 = total ? clampPct(masteryOnly / total) : 0;
  const p2 = total ? clampPct(fluencyOnly / total) : 0;
  const p3 = total ? clampPct(autoOnly / total) : 0;

  const left1 = p0;
  const left2 = p0 + p1;
  const left3 = p0 + p1 + p2;

  return (
    <XStack alignItems="center" height={8} gap={4}>
      <YStack width={10} alignItems="center" justifyContent="center">
        <Icon size={9} color={iconColor} />
      </YStack>
      <YStack
        flex={1}
        height={8}
        borderRadius={6}
        overflow="hidden"
        backgroundColor={trackColor}
        position="relative"
      >
        {/* Tier 0: exposed-only */}
        <YStack height="100%" width={`${p0 * 100}%`} backgroundColor={tier0} />

        {/* Tier 1: mastery-only */}
        <YStack
          position="absolute"
          top={0}
          left={`${left1 * 100}%`}
          height="100%"
          width={`${p1 * 100}%`}
          backgroundColor={tier1}
        />

        {/* Tier 2: fluency-only */}
        <YStack
          position="absolute"
          top={0}
          left={`${left2 * 100}%`}
          height="100%"
          width={`${p2 * 100}%`}
          backgroundColor={tier2}
        />

        {/* Tier 3: automaticity-only */}
        <YStack
          position="absolute"
          top={0}
          left={`${left3 * 100}%`}
          height="100%"
          width={`${p3 * 100}%`}
          backgroundColor={tier3}
        />
      </YStack>
    </XStack>
  );
}
