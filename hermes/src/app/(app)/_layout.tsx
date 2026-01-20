import "react-native-gesture-handler";
import React from "react";
import { Drawer } from "expo-router/drawer";
import {
  DrawerContentScrollView,
  DrawerItemList,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { View } from "react-native";
import { Text } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, WholeWord, NotepadText, Settings } from "@tamagui/lucide-icons";

function HermesDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 16 }}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text fontSize={18} fontWeight="900" color="$color">
          Hermes
        </Text>
        <Text marginTop={6} color="$textMuted">
          Pick a screen
        </Text>
      </View>

      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

export default function AppLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,

        drawerType: "front",
        drawerStyle: {
          backgroundColor: "#06101C",
          width: 280,
        },

        drawerActiveTintColor: "#E6EBFF",
        drawerInactiveTintColor: "#9BA3B4",

        drawerItemStyle: {
          borderRadius: 12,
          marginHorizontal: 10,
          marginVertical: 4,
        },

        drawerLabelStyle: {
          fontSize: 14,
          fontWeight: "800",
        },
      }}
      drawerContent={(props) => <HermesDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="home"
        options={{
          title: "Home",
          drawerIcon: ({ color, size }) => <Home color={color as any} size={size} />,
        }}
      />

      <Drawer.Screen
        name="vocab"
        options={{
          title: "Vocab",
          drawerIcon: ({ color, size }) => <WholeWord color={color as any} size={size} />,
        }}
      />

      <Drawer.Screen
        name="grammar"
        options={{
          title: "Grammar",
          drawerIcon: ({ color, size }) => <NotepadText color={color as any} size={size} />,
        }}
      />

      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerIcon: ({ color, size }) => <Settings color={color as any} size={size} />,
        }}
      />

      {/* Hide session routes from drawer */}
      <Drawer.Screen
        name="session/setup"
        options={{ title: "Session Setup", drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="session/concept"
        options={{ title: "Concept", drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="session/practice"
        options={{ title: "Practice", drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="session/results"
        options={{ title: "Results", drawerItemStyle: { display: "none" } }}
      />
    </Drawer>
  );
}
