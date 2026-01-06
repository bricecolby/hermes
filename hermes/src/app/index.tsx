import { Redirect } from "expo-router";
import { useAppState } from "../state/AppState";

export default function Index() {
  const { activeLanguageId } = useAppState();
  return activeLanguageId
  ? <Redirect href="/(app)/home" />
  : <Redirect href="/(onboarding)/profile" />;

}
