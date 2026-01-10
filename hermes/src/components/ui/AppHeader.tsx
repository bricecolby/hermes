import React from "react";
import { TouchableOpacity } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { XStack, Text, View } from "tamagui";
import { Menu } from "@tamagui/lucide-icons";

type Props = {
  title: string;
  right?: React.ReactNode;
};

export function AppHeader({ title, right }: Props) {
  const navigation = useNavigation();
  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());

  return (
    <XStack alignItems="center" justifyContent="space-between" marginBottom={12}>
      <TouchableOpacity onPress={openMenu} activeOpacity={0.8} style={{ width: 42, height: 42 }}>
        <XStack width={42} height={42} alignItems="center" justifyContent="center">
          <Menu size={26} color="white" />
        </XStack>
      </TouchableOpacity>

      <Text fontSize={26} fontWeight="900" color="$color">
        {title}
      </Text>

      <View width={42} height={42} alignItems="center" justifyContent="center">
        {right ?? null}
      </View>
    </XStack>
  );
}
