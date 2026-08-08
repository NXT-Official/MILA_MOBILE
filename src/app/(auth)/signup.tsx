import { View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { AuthCard, AuthDivider } from "@/features/auth/components/AuthCard";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { useGoogleSignIn } from "@/features/auth/hooks/use-auth-actions";

export default function SignupScreen() {
  const google = useGoogleSignIn();

  return (
    <Screen scroll>
      <AuthCard
        title="Get Started"
        subtitle="Log in or sign up below to unlock your studio color dossier."
      >
        <View className="w-full gap-xl">
          <GoogleButton onPress={() => google.mutate()} loading={google.isPending} />
          <AuthDivider label="or continue with email" />
          <SignupForm />
        </View>
      </AuthCard>
    </Screen>
  );
}
