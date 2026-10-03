import { View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { AuthCard, AuthDivider } from "@/features/auth/components/AuthCard";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useGoogleSignIn } from "@/features/auth/hooks/use-auth-actions";

export default function LoginScreen() {
  const google = useGoogleSignIn();

  return (
    <Screen scroll>
      <AuthCard
        title="Get Started"
        subtitle="Log in or sign up to see your studio color dossier."
      >
        <View className="w-full gap-xl">
          <GoogleButton onPress={() => google.mutateAsync()} loading={google.isPending} />
          <AuthDivider label="or continue with email" />
          <LoginForm />
        </View>
      </AuthCard>
    </Screen>
  );
}
