import React from 'react';
import { Text, Platform, StatusBar } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import GlobalSearchBar from '@/components/GlobalSearchBar';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 23 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const statusBarH = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 24)
    : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 12 : 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          // 안드로이드에서 상태바 영역 고려 - 높이를 자동으로 계산하도록 undefined로 설정
          height: undefined,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 16,
        },
        headerTitleAlign: 'center',
        // 안드로이드에서 상태바 높이 자동 계산 (edgeToEdge 대응: Math.max 사용)
        headerStatusBarHeight: statusBarH,
        // 비활성 탭 렌더링 중단 → Fabric 화면 전환 깜빡임 감소
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
          headerTitle: () => <GlobalSearchBar />,
          headerTitleAlign: 'left',
          headerTitleContainerStyle: {
            flex: 1,
            paddingHorizontal: 12,
            marginLeft: 0,
            marginRight: 0,
          },
        }}
      />
      <Tabs.Screen
        name="fridge"
        options={{
          title: '냉장고',
          tabBarIcon: () => <TabIcon emoji="❄️" />,
          headerTitle: '냉장고 관리',
        }}
      />
      <Tabs.Screen
        name="add-fridge"
        options={{
          title: '냉장고 등록',
          headerTitle: '새 냉장고 등록',
          href: null,
        }}
      />
      <Tabs.Screen
        name="fridge-settings"
        options={{
          title: '냉장고 설정',
          headerTitle: '냉장고 관리',
          href: null,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: '목록',
          tabBarIcon: () => <TabIcon emoji="📋" />,
          headerTitle: () => <GlobalSearchBar />,
          headerTitleAlign: 'left',
          headerTitleContainerStyle: {
            flex: 1,
            paddingHorizontal: 12,
            marginLeft: 0,
            marginRight: 0,
          },
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '등록',
          tabBarIcon: () => <TabIcon emoji="➕" />,
          headerTitle: '식재료 등록',
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '통계',
          tabBarIcon: () => <TabIcon emoji="📊" />,
          headerTitle: '소비 통계',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: () => <TabIcon emoji="⚙️" />,
          headerTitle: '설정',
        }}
      />
    </Tabs>
  );
}
