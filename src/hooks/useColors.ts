import { useTheme } from '@/contexts/ThemeContext';
import { getColors, type AppColors } from '@/constants/colors';

export function useColors(): AppColors {
  const { isDark } = useTheme();
  return getColors(isDark);
}
