import { Redirect } from "expo-router";
import { useAppState } from "../state/AppState";

export default function Index() {
  const { activeProfileId } = useAppState();

  return activeProfileId
    ? <Redirect href="/(app)/home" />
    : <Redirect href="/(onboarding)/profile" />;
}
