import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useFoodStore } from '@/hooks/useFoodStore';
import { rescheduleAllNotifications, getScheduledNotificationCount } from '@/lib/notificationScheduler';
import { exportBackup, importBackup } from '@/lib/backupRestore';

const TIME_OPTIONS = ['07:00', '08:00', '09:00', '10:00', '12:00'];
const QUIET_START_OPTIONS = ['21:00', '22:00', '23:00'];
const QUIET_END_OPTIONS = ['06:00', '07:00', '08:00'];

type ThemeMode = 'light' | 'dark' | 'system';

export default function SettingsScreen() {
  const c = useColors();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const totalItems = useFoodStore((s) => s.items.length);
  const totalTemplates = useFoodStore((s) => s.templates.length);
  const settings = useFoodStore((s) => s.notificationSettings);
  const updateSettings = useFoodStore((s) => s.updateNotificationSettings);
  const items = useFoodStore((s) => s.items);
  const [scheduledCount, setScheduledCount] = useState<number | null>(null);
  const loadItems = useFoodStore((s) => s.loadItems);
  const loadNotificationSettings = useFoodStore((s) => s.loadNotificationSettings);

  const handleToggle = async (key: 'summary_enabled' | 'urgent_enabled' | 'quiet_hours_enabled', value: boolean) => {
    await updateSettings({ [key]: value });
    const currentSettings = { ...settings, [key]: value };
    await rescheduleAllNotifications(items, currentSettings);
  };

  const handleTimePick = (options: string[], currentValue: string, label: string, key: string) => {
    Alert.alert(label, '시간을 선택하세요', [
      ...options.map((time) => ({
        text: time + (time === currentValue ? ' ✓' : ''),
        onPress: async () => {
          await updateSettings({ [key]: time });
          const currentSettings = { ...settings, [key]: time };
          await rescheduleAllNotifications(items, currentSettings);
        },
      })),
      { text: '취소', style: 'cancel' as const },
    ]);
  };

  const handleThemePick = () => {
    Alert.alert('테마 선택', '앱 테마를 선택하세요', [
      { text: '시스템 설정' + (themeMode === 'system' ? ' ✓' : ''), onPress: () => setThemeMode('system') },
      { text: '라이트' + (themeMode === 'light' ? ' ✓' : ''), onPress: () => setThemeMode('light') },
      { text: '다크' + (themeMode === 'dark' ? ' ✓' : ''), onPress: () => setThemeMode('dark') },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const themeLabel = themeMode === 'system' ? '시스템 설정' : themeMode === 'light' ? '라이트' : '다크';

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      {/* 앱 정보 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>앱 정보</Text>
        <View style={[styles.infoCard, { backgroundColor: c.surface }]}>
          <Text style={[styles.appName, { color: c.primary }]}>냉장고 지킴이</Text>
          <Text style={[styles.appVersion, { color: c.textSecondary }]}>v1.0.0</Text>
          <View style={styles.statsRow}>
            <Text style={[styles.statText, { color: c.textSecondary }]}>등록 식재료: {totalItems}개</Text>
            <Text style={[styles.statText, { color: c.textSecondary }]}>템플릿: {totalTemplates}개</Text>
          </View>
        </View>
      </View>

      {/* 화면 설정 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>화면 설정</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <Pressable
            style={[styles.settingRow, { borderBottomColor: c.divider }]}
            onPress={handleThemePick}
            accessibilityLabel={`테마: ${themeLabel}`}
            accessibilityHint="테마를 변경하려면 탭하세요"
            accessibilityRole="button"
          >
            <Text style={styles.settingIcon}>🎨</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>테마</Text>
            <Text style={[styles.settingValue, { color: c.textSecondary }]}>{themeLabel}</Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* 요약 알림 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>요약 알림</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <View style={[styles.settingRow, { borderBottomColor: c.divider }]}>
            <Text style={styles.settingIcon}>🔔</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>매일 요약 알림</Text>
            <Switch
              value={settings.summary_enabled}
              onValueChange={(v) => handleToggle('summary_enabled', v)}
              trackColor={{ false: c.divider, true: c.primaryLight }}
              thumbColor={settings.summary_enabled ? c.primary : c.textLight}
            />
          </View>
          {settings.summary_enabled && (
            <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={() => handleTimePick(TIME_OPTIONS, settings.summary_time, '요약 알림 시간', 'summary_time')}>
              <Text style={styles.settingIcon}>⏰</Text>
              <Text style={[styles.settingLabel, { color: c.text }]}>알림 시간</Text>
              <Text style={[styles.settingValue, { color: c.textSecondary }]}>{settings.summary_time}</Text>
              <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 긴급 알림 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>긴급 알림</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <View style={[styles.settingRow, { borderBottomColor: c.divider }]}>
            <Text style={styles.settingIcon}>🚨</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>만료 긴급 알림</Text>
            <Switch
              value={settings.urgent_enabled}
              onValueChange={(v) => handleToggle('urgent_enabled', v)}
              trackColor={{ false: c.divider, true: c.primaryLight }}
              thumbColor={settings.urgent_enabled ? c.primary : c.textLight}
            />
          </View>
        </View>
      </View>

      {/* 방해 금지 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>방해 금지</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <View style={[styles.settingRow, { borderBottomColor: c.divider }]}>
            <Text style={styles.settingIcon}>🌙</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>방해 금지 시간</Text>
            <Switch
              value={settings.quiet_hours_enabled}
              onValueChange={(v) => handleToggle('quiet_hours_enabled', v)}
              trackColor={{ false: c.divider, true: c.primaryLight }}
              thumbColor={settings.quiet_hours_enabled ? c.primary : c.textLight}
            />
          </View>
          {settings.quiet_hours_enabled && (
            <>
              <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={() => handleTimePick(QUIET_START_OPTIONS, settings.quiet_hours_start, '방해 금지 시작', 'quiet_hours_start')}>
                <Text style={styles.settingIcon}>🌜</Text>
                <Text style={[styles.settingLabel, { color: c.text }]}>시작 시간</Text>
                <Text style={[styles.settingValue, { color: c.textSecondary }]}>{settings.quiet_hours_start}</Text>
                <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
              </Pressable>
              <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={() => handleTimePick(QUIET_END_OPTIONS, settings.quiet_hours_end, '방해 금지 종료', 'quiet_hours_end')}>
                <Text style={styles.settingIcon}>🌅</Text>
                <Text style={[styles.settingLabel, { color: c.text }]}>종료 시간</Text>
                <Text style={[styles.settingValue, { color: c.textSecondary }]}>{settings.quiet_hours_end}</Text>
                <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* 알림 관리 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>알림 관리</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={async () => {
            const count = await getScheduledNotificationCount();
            setScheduledCount(count);
            Alert.alert('예약된 알림', `현재 ${count}개의 알림이 예약되어 있습니다.`);
          }}>
            <Text style={styles.settingIcon}>📊</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>예약된 알림 확인</Text>
            <Text style={[styles.settingValue, { color: c.textSecondary }]}>{scheduledCount !== null ? `${scheduledCount}개` : ''}</Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>
          <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={async () => {
            const count = await rescheduleAllNotifications(items, settings);
            Alert.alert('알림 재설정', `${count}개의 알림을 새로 예약했습니다.`);
          }}>
            <Text style={styles.settingIcon}>🔄</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>알림 재설정</Text>
            <Text style={[styles.settingValue, { color: c.textSecondary }]}></Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* 데이터 관리 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>데이터 관리</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={async () => {
            try { await exportBackup(); } catch (e: any) { Alert.alert('백업 실패', e.message ?? '알 수 없는 오류'); }
          }}>
            <Text style={styles.settingIcon}>📤</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>데이터 백업</Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>
          <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={() => {
            Alert.alert('데이터 복원', '기존 데이터가 모두 삭제되고 백업 파일로 교체됩니다.\n계속하시겠습니까?', [
              { text: '취소', style: 'cancel' },
              {
                text: '복원', style: 'destructive',
                onPress: async () => {
                  try {
                    const result = await importBackup();
                    await loadItems();
                    await loadNotificationSettings();
                    Alert.alert('복원 완료', `식재료 ${result.items}개, 이력 ${result.history}개 복원`);
                  } catch (e: any) {
                    if (e.message?.includes('취소')) return;
                    Alert.alert('복원 실패', e.message ?? '알 수 없는 오류');
                  }
                },
              },
            ]);
          }}>
            <Text style={styles.settingIcon}>📥</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>데이터 복원</Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* 기술 정보 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>기술 스택</Text>
        <View style={[styles.techCard, { backgroundColor: c.surface }]}>
          <Text style={[styles.techText, { color: c.textSecondary }]}>React Native (Expo SDK 54)</Text>
          <Text style={[styles.techText, { color: c.textSecondary }]}>TypeScript + Zustand + SQLite</Text>
          <Text style={[styles.techText, { color: c.textSecondary }]}>완전 오프라인 (인터넷 불필요)</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  infoCard: { borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 },
  appName: { fontSize: 20, fontWeight: '800' },
  appVersion: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  statText: { fontSize: 13 },
  settingCard: { borderRadius: 12, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  settingIcon: { fontSize: 18, marginRight: 10 },
  settingLabel: { flex: 1, fontSize: 15 },
  settingValue: { fontSize: 13, marginRight: 8 },
  settingArrow: { fontSize: 18 },
  techCard: { borderRadius: 12, padding: 14, gap: 4 },
  techText: { fontSize: 13 },
});
