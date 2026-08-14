import { useLocalSearchParams } from "expo-router";

import { MemberProfileScreen } from "@/features/feed/MemberProfileScreen";

export default function MemberProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <MemberProfileScreen userId={userId} />;
}
