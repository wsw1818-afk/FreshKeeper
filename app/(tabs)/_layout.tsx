import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import GlobalSearchBar from '@/components/GlobalSearchBar';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
          headerTitle: () => <GlobalSearchBar />,
          headerTitleContainerStyle: { flex: 1, left: 0, right: 0, paddingHorizontal: 4 },
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: '목록',
          tabBarIcon: () => <TabIcon emoji="📋" />,
          headerTitle: () => <GlobalSearchBar />,
          headerTitleContainerStyle: { flex: 1, left: 0, right: 0, paddingHorizontal: 4 },
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
