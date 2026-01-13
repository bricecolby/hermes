import React from "react";
import { TouchableOpacity } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { XStack, YStack, Text, View } from "tamagui";
import { Menu } from "@tamagui/lucide-icons";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function AppHeader({ title, subtitle, right }: Props) {
  const navigation = useNavigation();
  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());

  return (
    <XStack alignItems="center" marginBottom={12}>
      {/* Left: menu */}
      <TouchableOpacity onPress={openMenu} activeOpacity={0.8} style={{ width: 42, height: 42 }}>
        <XStack width={42} height={42} alignItems="center" justifyContent="center">
          <Menu size={26} color="white" />
        </XStack>
      </TouchableOpacity>

      {/* Center: title + subtitle */}
      <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$2">
        <Text fontSize={26} fontWeight="900" color="$color" numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text fontSize={14} fontWeight="600" color="$color11" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>

      {/* Right: slot (keep width fixed so center stays centered) */}
      <View width={42} height={42} alignItems="center" justifyContent="center">
        {right ?? null}
      </View>
    </XStack>
  );
}
