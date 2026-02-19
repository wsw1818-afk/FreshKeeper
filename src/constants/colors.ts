const light = {
  // 상태별 색상
  status: {
    safe: '#4CAF50',
    warn: '#FF9800',
    danger: '#F44336',
    expired: '#9E9E9E',
    longTerm: '#2196F3',
    checkNeeded: '#FF5722',
  },
  statusBg: {
    safe: '#E8F5E9',
    warn: '#FFF3E0',
    danger: '#FFEBEE',
    expired: '#F5F5F5',
    longTerm: '#E3F2FD',
    checkNeeded: '#FBE9E7',
  },
  location: {
    FRIDGE: '#42A5F5',
    FREEZER: '#7E57C2',
    PANTRY: '#8D6E63',
    KIMCHI_FRIDGE: '#66BB6A',
  },
  primary: '#2E7D32',
  primaryLight: '#60AD5E',
  primaryDark: '#005005',
  accent: '#FF6F00',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#BDBDBD',
  border: '#E0E0E0',
  divider: '#EEEEEE',
  white: '#FFFFFF',
  black: '#000000',
  error: '#D32F2F',
  success: '#388E3C',
};

const dark: typeof light = {
  status: {
    safe: '#66BB6A',
    warn: '#FFA726',
    danger: '#EF5350',
    expired: '#9E9E9E',
    longTerm: '#42A5F5',
    checkNeeded: '#FF7043',
  },
  statusBg: {
    safe: '#1B3D1E',
    warn: '#3E2A10',
    danger: '#3E1416',
    expired: '#2A2A2A',
    longTerm: '#0D2744',
    checkNeeded: '#3E1D14',
  },
  location: {
    FRIDGE: '#42A5F5',
    FREEZER: '#9575CD',
    PANTRY: '#A1887F',
    KIMCHI_FRIDGE: '#66BB6A',
  },
  primary: '#66BB6A',
  primaryLight: '#81C784',
  primaryDark: '#338A3E',
  accent: '#FFB74D',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#E0E0E0',
  textSecondary: '#9E9E9E',
  textLight: '#616161',
  border: '#333333',
  divider: '#2A2A2A',
  white: '#FFFFFF',
  black: '#000000',
  error: '#EF5350',
  success: '#66BB6A',
};

export type AppColors = typeof light;

// 기본 라이트 테마 (기존 호환)
export const Colors = light;

export const LightColors = light;
export const DarkColors = dark;

export function getColors(isDark: boolean): AppColors {
  return isDark ? dark : light;
}
