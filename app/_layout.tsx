import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFoodStore } from '@/hooks/useFoodStore';
import { Colors } from '@/constants/colors';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { setupNotifications, rescheduleAllNotifications } from '@/lib/notificationScheduler';
import OnboardingScreen from '@/components/OnboardingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import logger from '@/lib/logger';

// Android 글로벌: includeFontPadding 제거 → 한글 텍스트 높이 정상화
// (잘림과 무관함이 확인됨; 제거 시 텍스트가 커지는 회귀 발생)
if (Platform.OS === 'android') {
  const origRender = (Text as any).render;
  if (typeof origRender === 'function') {
    (Text as any).render = function (props: any, ref: any) {
      return origRender.call(this, {
        ...props,
        style: [{ includeFontPadding: false }, props.style],
      }, ref);
    };
  }
}

const ONBOARDING_KEY = '@freshkeeper_onboarded';

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const loadItems = useFoodStore((s) => s.loadItems);
  const loadTemplates = useFoodStore((s) => s.loadTemplates);
  const loadStorageLocations = useFoodStore((s) => s.loadStorageLocations);
  const loadNotificationSettings = useFoodStore((s) => s.loadNotificationSettings);
  const { isDark } = useTheme();
  const colors = useColors();

  useEffect(() => {
    async function init() {
      try {
        logger.info('🚀 FreshKeeper App Starting...');

        // 온보딩 상태 확인
        const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!onboarded) {
          logger.info('First time user - showing onboarding');
          setShowOnboarding(true);
        }

        logger.info('Loading templates...');
        await loadTemplates();

        logger.info('Loading storage locations...');
        await loadStorageLocations();

        logger.info('Loading food items...');
        await loadItems();

        logger.info('Loading notification settings...');
        await loadNotificationSettings();

        // 알림 초기화 및 스케줄링
        logger.info('Setting up notifications...');
        const granted = await setupNotifications();
        if (granted) {
          const { items, notificationSettings } = useFoodStore.getState();
          logger.info(`Rescheduling notifications for ${items.length} items`);
          await rescheduleAllNotifications(items, notificationSettings);
        } else {
          logger.warn('Notification permission not granted');
        }

        logger.info('✅ App initialization complete');
      } catch (e) {
        logger.error('❌ 초기화 실패:', e);
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, []);

  const handleOnboardingComplete = async (selectedFridges?: string[]) => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    // 선택한 냉장고 정보 저장
    if (selectedFridges && selectedFridges.length > 0) {
      await AsyncStorage.setItem('@freshkeeper_selected_fridges', JSON.stringify(selectedFridges));
    }
    setShowOnboarding(false);
    // 저장 후 다시 로드
    await loadStorageLocations();
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
            contentStyle: { backgroundColor: colors.background },
            animation: 'none',
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
