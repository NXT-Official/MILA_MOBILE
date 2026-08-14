import { Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { passwordRuleResults } from "@/constants/password";

/**
 * Strength hints for signup (§3). Not in the web design, which shows the field
 * alone — added because the architecture requires them and a member who learns
 * the rule only after a rejected submit types the password twice.
 *
 * Per the Colour-Is-Content Rule, a met rule carries a check glyph as well as
 * the colour change; hue alone never encodes state.
 */
export function PasswordChecklist({ value }: { value: string }) {
  if (!value) return null;

  return (
    <View className="w-full gap-xs" accessibilityRole="list">
      {passwordRuleResults(value).map((rule) => (
        <View key={rule.id} className="flex-row items-center gap-sm">
          <Icon name={rule.met ? "check" : "close"} size="xs" color={rule.met ? "success" : "muted"} />
          <Text
            accessibilityLabel={`${rule.label}: ${rule.met ? "met" : "not met"}`}
            className={rule.met ? "font-body text-sm text-body" : "font-body text-sm text-muted"}
          >
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
