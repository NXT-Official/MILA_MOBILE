import { Text, View } from "react-native";

/**
 * The bottom sheet, stood in for in jest. The real one needs the gesture and
 * portal native modules; the tests only need what a member would read — the
 * title and the body — and nothing at all while the sheet is closed.
 */
export function Sheet({
  visible,
  title,
  headerAction,
  children,
}: {
  visible: boolean;
  title: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <View>
      <Text>{title}</Text>
      {headerAction}
      {children}
    </View>
  );
}
