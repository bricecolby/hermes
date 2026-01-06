import "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";

export default function AppLayout() {
  return (
    <Drawer screenOptions={{ headerShown: true }}>
      <Drawer.Screen name="home" options={{ title: "Home" }} />
      <Drawer.Screen name="library-vocab" options={{ title: "Vocab" }} />
      <Drawer.Screen name="library-grammar" options={{ title: "Grammar" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />

      {/* Hide session routes from drawer */}
      <Drawer.Screen name="session/setup" options={{ title: "Session Setup", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="session/concept" options={{ title: "Concept", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="session/practice" options={{ title: "Practice", drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="session/results" options={{ title: "Results", drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}
