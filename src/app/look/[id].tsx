import { useLocalSearchParams } from "expo-router";

import { LookDetailScreen } from "@/features/outfits/LookDetailScreen";

export default function Look() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LookDetailScreen id={id} />;
}
