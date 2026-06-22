import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the active theme.
 *
 * Theme is driven by ThemeContext (user preference: Light / Dark / System).
 * When preference is "system" it follows the device's color scheme.
 */
export function useColors() {
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
