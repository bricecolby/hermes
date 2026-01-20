import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as SQLite from "expo-sqlite";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

import { YStack, Text, View } from "tamagui";

import { GlassCard } from "@/components/ui/GlassCard";
import { GradientBorderCard } from "@/components/ui/GradientBorderCard";
import { useAppState } from "@/state/AppState";

import Logo from "@/assets/images/1x/logo3.svg";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "@/db/queries/users";

const MVP_USERNAME = "default";

export default function Profile() {
  const router = useRouter();
  const { setActiveProfile } = useAppState();

  const db = SQLite.useSQLiteContext();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);


  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
      setProfiles(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load profiles");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSelect = async (p: LanguageProfileRow) => {
    await setActiveProfile({ profileId: p.userId, learningLangId: p.learningLangId });
    router.replace("/(app)/home");
  };

  const renderProfile = ({ item }: { item: LanguageProfileRow }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onSelect(item)}>
      <GlassCard>
        <Text fontSize={16} fontWeight="800" color="$color">
          {item.learningName}
        </Text>
        <Text marginTop={8} color="$textMuted">
          {item.learningCode} • {item.nativeCode} • lvl {item.level} • xp {item.xp}
        </Text>
      </GlassCard>
    </TouchableOpacity>
  );

  const ListFooter = () => (
    <YStack marginTop={16} paddingBottom={12}>
      <TouchableOpacity onPress={() => router.push("/(modals)/add-language")} activeOpacity={0.9}>
        <GradientBorderCard>
          <Text fontSize={16} fontWeight="800" color="$color">
            Add Language
          </Text>
          <Text marginTop={8} color="$textMuted">
            Choose another supported language pack
          </Text>
        </GradientBorderCard>
      </TouchableOpacity>
    </YStack>
  );

  return (
    <LinearGradient
      colors={["#06101C", "#0B1220", "#06101C"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar style="light" />

      <YStack flex={1} paddingHorizontal={24} paddingTop={72} paddingBottom={18}>

        <YStack alignItems="center" marginBottom={16}>
          <View style={{ marginLeft: 30 }}>
            <Logo width={172} height={172} />
          </View>

          <Text
            fontSize={30}
            fontWeight="800"
            letterSpacing={0.4}
            color="$color"
            marginTop={12}
          >
            Hermes
          </Text>

          <Text fontSize={14} color="$textMuted" marginTop={8} textAlign="center">
            Pick a profile to continue.
          </Text>
        </YStack>

        <YStack flex={1} marginTop={12}>
          {loading ? (
            <YStack
              marginTop={16}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={12}
            >
              <ActivityIndicator />
              <Text marginTop={12} color="$textFaint" textAlign="center">
                Loading profiles…
              </Text>
            </YStack>
          ) : err ? (
            <YStack
              marginTop={16}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={12}
            >
              <Text color="$textFaint" textAlign="center">
                {err}
              </Text>
            </YStack>
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={(x) => String(x.userId)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 10, paddingBottom: 16, gap: 12 }}
              renderItem={renderProfile}
              ListEmptyComponent={
                <YStack
                  marginTop={16}
                  alignItems="center"
                  justifyContent="center"
                  paddingHorizontal={12}
                >
                  <Text color="$textFaint" textAlign="center">
                    No profiles yet. Add one to get started.
                  </Text>
                </YStack>
              }
              ListFooterComponent={ListFooter}
            />
          )}
        </YStack>

        <Text color="#5E6C8A" fontSize={12} textAlign="center" paddingTop={12} marginBottom={20}>
          © 2026 Hermes
        </Text>
      </YStack>
    </LinearGradient>
  );
}
