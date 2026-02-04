import React, { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";
import { XStack, YStack, Text } from "tamagui";

import { useAppState } from "@/state/AppState";

type Point = {
  key: string;
  labelTop: string;     // e.g., "Over", "Today", "Thu"
  labelBottom?: string;
  count: number;
  tone: "overdue" | "normal";
};

type Props = {
  userId?: number;
  modelKey?: string;     // default "ema_v1"
  daysToShow?: number;   // default 14 (in addition to overdue + today)
  maxBarHeight?: number; // default 34
};

function startOfDayMs(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayDiff(fromMs: number, toMs: number) {
  const a = startOfDayMs(fromMs);
  const b = startOfDayMs(toMs);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function fmtDowShort(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
}

function fmtMonthDay(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function ReviewForecast({
  userId,
  modelKey = "ema_v1",
  daysToShow = 14,
  maxBarHeight = 34,
}: Props) {
  const db = useSQLiteContext();
  const { activeProfileId } = useAppState();
  const effectiveUserId = userId ?? activeProfileId ?? null;

  const [loading, setLoading] = useState(false);
  const [dueAts, setDueAts] = useState<number[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      if (!effectiveUserId) return;

      let cancelled = false;
      setLoading(true);

      (async () => {
        const rows = await db.getAllAsync<{ due_at: string | null }>(
          `SELECT due_at
           FROM user_concept_mastery
           WHERE user_id = ?
             AND model_key = ?
             AND due_at IS NOT NULL;`,
          [effectiveUserId, modelKey]
        );

        const parsed = rows
          .map((r) => (r.due_at ? Date.parse(r.due_at) : NaN))
          .filter((t) => Number.isFinite(t)) as number[];

        if (!cancelled) setDueAts(parsed);
      })()
        .catch((e) => {
          console.warn("[ReviewForecastChart] load failed", e);
          if (!cancelled) setDueAts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [db, effectiveUserId, modelKey])
  );

  const points = useMemo<Point[]>(() => {
    const now = Date.now();
    const today0 = startOfDayMs(now);

    const counts = new Map<number, number>();
    let overdue = 0;

    for (const t of dueAts) {
      const dd = dayDiff(now, t);
      if (t < now) {
        overdue += 1;
        continue;
      }
      counts.set(dd, (counts.get(dd) ?? 0) + 1);
    }

    const out: Point[] = [
      { key: "overdue", labelTop: "Over", labelBottom: undefined, count: overdue, tone: "overdue" },
    ];

    for (let i = 0; i <= daysToShow; i++) {
      const dayMs = today0 + i * 24 * 60 * 60 * 1000;
      out.push({
        key: `d${i}`,
        labelTop: i === 0 ? "Today" : i === 1 ? "Tom" : fmtDowShort(dayMs),
        labelBottom: i <= 1 ? undefined : fmtMonthDay(dayMs),
        count: counts.get(i) ?? 0,
        tone: "normal",
      });
    }

    return out;
  }, [dueAts, daysToShow]);

  const { dueNow, maxCount } = useMemo(() => {
    const overdue = points.find((p) => p.key === "overdue")?.count ?? 0;
    const today = points.find((p) => p.key === "d0")?.count ?? 0;
    const dueNow = overdue + today;

    const maxCount = Math.max(1, ...points.map((p) => p.count));
    return { dueNow, maxCount };
  }, [points]);

  return (
    <YStack
      borderWidth={1}
      borderColor="rgba(255,255,255,0.08)"
      backgroundColor="rgba(255,255,255,0.03)"
      borderRadius={18}
      padding={14}
      gap={10}
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={16} fontWeight="900" color="$text">
          Reviews
        </Text>
        <Text fontSize={12} color="$textMuted">
          {loading ? "Loading…" : `${dueNow} due today`}
        </Text>
      </XStack>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap={12} paddingRight={6} alignItems="flex-end">
          {points.map((p) => {
            const h =
              p.count === 0
                ? 4
                : clamp((p.count / maxCount) * maxBarHeight, 6, maxBarHeight);

            const barColor =
              p.tone === "overdue"
                ? "rgba(255, 150, 170, 0.85)"
                : "rgba(80, 220, 230, 0.85)";

            const barGlow =
              p.tone === "overdue"
                ? "rgba(255, 150, 170, 0.22)"
                : "rgba(80, 220, 230, 0.18)";

            return (
              <YStack key={p.key} width={44} alignItems="center" gap={6}>
                {/* bar */}
                <YStack
                  width={28}
                  height={Math.round(h)}
                  borderRadius={5}
                  backgroundColor={barColor}
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.10)"
                  style={{
                    shadowColor: barGlow,
                    shadowOpacity: 1,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />

                {/* labels */}
                <YStack alignItems="center" gap={2}>
                  <Text
                    fontSize={11}
                    fontWeight="800"
                    color={p.tone === "overdue" ? "rgba(255, 170, 190, 0.95)" : "$textMuted"}
                  >
                    {p.labelTop}
                  </Text>
{/* 
                  {p.labelBottom ? (
                    <Text fontSize={10} color="$textMuted" opacity={0.85}>
                      {p.labelBottom}
                    </Text>
                  ) : (
                    <YStack height={12} />
                  )} */}
                </YStack>

                {/* count (tiny) */}
                <Text fontSize={11} fontWeight="800" opacity={0.9}>
                  {loading ? "—" : p.count}
                </Text>
              </YStack>
            );
          })}
        </XStack>
      </ScrollView>
    </YStack>
  );
}
