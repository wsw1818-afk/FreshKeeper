import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFoodStore } from '@/hooks/useFoodStore';
import { Colors } from '@/constants/colors';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { setupNotifications, rescheduleAllNotifications } from '@/lib/notificationScheduler';
import OnboardingScreen from '@/components/OnboardingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';

const ONBOARDING_KEY = '@freshkeeper_onboarded';

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const loadItems = useFoodStore((s) => s.loadItems);
  const loadTemplates = useFoodStore((s) => s.loadTemplates);
  const loadNotificationSettings = useFoodStore((s) => s.loadNotificationSettings);
  const { isDark } = useTheme();
  const colors = useColors();

  useEffect(() => {
    async function init() {
      try {
        // 온보딩 상태 확인
        const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!onboarded) {
          setShowOnboarding(true);
        }

        await loadTemplates();
        await loadItems();
        await loadNotificationSettings();

        // 알림 초기화 및 스케줄링
        const granted = await setupNotifications();
        if (granted) {
          const { items, notificationSettings } = useFoodStore.getState();
          await rescheduleAllNotifications(items, notificationSettings);
        }
      } catch (e) {
        console.error('초기화 실패:', e);
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, []);

  const handleOnboardingComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="item/[id]"
          options={{
            headerShown: true,
            title: '상세',
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
