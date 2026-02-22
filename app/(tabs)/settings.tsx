import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useFoodStore } from '@/hooks/useFoodStore';
import { rescheduleAllNotifications, getScheduledNotificationCount } from '@/lib/notificationScheduler';
import { exportBackup, importBackup } from '@/lib/backupRestore';
import {
  type AIProvider,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_COST,
  AI_PROVIDER_URL,
  AI_MODEL_INFO,
  OCR_RECOMMENDATION_RANK,
  getRecommendationLabel,
  validateAPIKeyFormat,
  getAIProvider,
  saveAIProvider,
  getAPIKey,
  saveAPIKey,
} from '@/lib/aiApiConfig';

const TIME_OPTIONS = ['07:00', '08:00', '09:00', '10:00', '12:00'];
const QUIET_START_OPTIONS = ['21:00', '22:00', '23:00'];
const QUIET_END_OPTIONS = ['06:00', '07:00', '08:00'];

type ThemeMode = 'light' | 'dark' | 'system';

export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const totalItems = useFoodStore((s) => s.items.length);
  const totalTemplates = useFoodStore((s) => s.templates.length);
  const settings = useFoodStore((s) => s.notificationSettings);
  const updateSettings = useFoodStore((s) => s.updateNotificationSettings);
  const items = useFoodStore((s) => s.items);
  const [scheduledCount, setScheduledCount] = useState<number | null>(null);
  const loadItems = useFoodStore((s) => s.loadItems);
  const loadNotificationSettings = useFoodStore((s) => s.loadNotificationSettings);

  // AI API 설정 상태
  const [aiProvider, setAiProvider] = useState<AIProvider>('none');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [isAiKeySaving, setIsAiKeySaving] = useState(false);

  useEffect(() => {
    (async () => {
      const provider = await getAIProvider();
      const key = await getAPIKey(provider);
      setAiProvider(provider);
      setAiApiKey(key);
      setAiApiKeyInput(key);
    })();
  }, []);

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

  // 추천 순서로 프로바이더 정렬
  const PROVIDERS: AIProvider[] = [...OCR_RECOMMENDATION_RANK];

  const handleAIProviderPick = () => {
    const options = PROVIDERS.map((p) => {
      const info = AI_MODEL_INFO[p];
      const label = getRecommendationLabel(p);
      const costLabel = p === 'none' ? '물뵤' : info.cost;
      return {
        text: `${label ? `${label}\n` : ''}${info.name} - ${costLabel}${p === aiProvider ? ' ✓' : ''}`,
        onPress: async () => {
          await saveAIProvider(p);
          const key = await getAPIKey(p);
          setAiProvider(p);
          setAiApiKey(key);
          setAiApiKeyInput(key);
        },
      };
    });

    Alert.alert(
      '🤖 AI OCR 프로바이더 선택',
      '유통기한 인식에 사용할 AI 모델을 선택하세요.\n\n💡 추천: Gemini (물뵤 티어 넉넉)',
      [
        ...options,
        { text: '취소', style: 'cancel' as const },
      ]
    );
  };

  const handleShowModelInfo = () => {
    const info = AI_MODEL_INFO[aiProvider];
    if (aiProvider === 'none') {
      Alert.alert(
        '오프라인 모드',
        '인터넷 연결 없이 텍스트 패턴 인식만 사용합니다.\n\n정확도가 제한적이며, 복잡한 이미지는 인식하지 못할 수 있습니다.'
      );
      return;
    }

    Alert.alert(
      `${info.name} 상세 정보`,
      `제공사: ${info.provider}\n` +
      `가격: ${info.cost}\n` +
      `OCR 정확도: ${info.ocrAccuracy === 'excellent' ? '최우수 ⭐⭐⭐' : info.ocrAccuracy === 'good' ? '우수 ⭐⭐' : '보통 ⭐'}\n` +
      `물뵤 티어: ${info.freeTier}\n\n` +
      `장점:\n${info.pros.map(p => `• ${p}`).join('\n')}\n\n` +
      `가입: ${info.signupUrl}`
    );
  };

  const handleAISaveKey = async () => {
    if (aiProvider === 'none') return;

    // 키 형식 검증
    if (!validateAPIKeyFormat(aiProvider, aiApiKeyInput)) {
      Alert.alert(
        'API 키 형식 오류',
        '입력하신 키가 올바른 형식이 아닙니다.\n\n' +
        '제공사에서 발급받은 올바른 API 키를 입력해주세요.'
      );
      return;
    }

    setIsAiKeySaving(true);
    try {
      await saveAPIKey(aiProvider, aiApiKeyInput);
      setAiApiKey(aiApiKeyInput);
      Alert.alert('✅ 저장 완료', 'API 키가 안전하게 저장되었습니다.');
    } catch {
      Alert.alert('❌ 오류', 'API 키 저장에 실패했습니다.');
    } finally {
      setIsAiKeySaving(false);
    }
  };

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

      {/* 냉장고 관리 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>냉장고 관리</Text>
        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <Pressable style={[styles.settingRow, { borderBottomColor: c.divider }]} onPress={() => router.push('/(tabs)/fridge-settings')}>
            <Text style={styles.settingIcon}>🧊</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>냉장고 설정</Text>
            <Text style={[styles.settingValue, { color: c.textSecondary }]}></Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>
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
            Alert.alert('데이터 복원', '기존 데이터가 모두 삭제되고 백업 파일로 교첼됩니다.\n계속하시겠습니까?', [
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

      {/* AI API 설정 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>🤖 AI OCR 설정</Text>

        {/* 추천 배너 */}
        {aiProvider === 'none' && (
          <Pressable
            style={[styles.recommendBanner, { backgroundColor: c.statusBg.safe }]}
            onPress={() => {
              saveAIProvider('gemini').then(() => {
                setAiProvider('gemini');
                getAPIKey('gemini').then(key => {
                  setAiApiKey(key);
                  setAiApiKeyInput(key);
                });
              });
            }}
          >
            <Text style={[styles.recommendTitle, { color: c.status.safe }]}>🥇 추천: Gemini 1.5 Flash</Text>
            <Text style={[styles.recommendDesc, { color: c.textSecondary }]}>
              물뵤 티어로 1,500회/일 사용 가능 • 한국어 OCR 우수
            </Text>
          </Pressable>
        )}

        <View style={[styles.settingCard, { backgroundColor: c.surface }]}>
          <Pressable
            style={[styles.settingRow, { borderBottomColor: c.divider }]}
            onPress={handleAIProviderPick}
            accessibilityRole="button"
          >
            <Text style={styles.settingIcon}>🤖</Text>
            <View style={styles.aiProviderInfo}>
              <Text style={[styles.settingLabel, { color: c.text }]}>AI 모델</Text>
              <Text style={[styles.aiModelSubtitle, { color: c.textSecondary }]}>
                {aiProvider !== 'none' ? getRecommendationLabel(aiProvider) : '선택해주세요'}
              </Text>
            </View>
            <Text style={[styles.settingValue, { color: c.textSecondary }]} numberOfLines={1}>
              {AI_PROVIDER_LABELS[aiProvider].split(' ')[0]}
            </Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.settingRow, { borderBottomColor: c.divider }]}
            onPress={handleShowModelInfo}
          >
            <Text style={styles.settingIcon}>💰</Text>
            <Text style={[styles.settingLabel, { color: c.text }]}>가격 & 정보</Text>
            <Text style={[styles.settingValue, { color: c.textSecondary }]}>
              {AI_PROVIDER_COST[aiProvider]}
            </Text>
            <Text style={[styles.settingArrow, { color: c.textLight }]}>›</Text>
          </Pressable>

          {aiProvider !== 'none' && (
            <View style={[styles.apiKeySection, { borderBottomColor: c.divider }]}>
              <View style={styles.apiKeyLabelRow}>
                <Text style={styles.settingIcon}>🔑</Text>
                <Text style={[styles.settingLabel, { color: c.text }]}>API 키</Text>
                {AI_PROVIDER_URL[aiProvider] ? (
                  <Text style={[styles.apiKeyLink, { color: c.primary }]} numberOfLines={1}>
                    {AI_PROVIDER_URL[aiProvider].replace('https://', '')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.apiKeyInputRow}>
                <TextInput
                  style={[styles.apiKeyInput, { backgroundColor: c.background, borderColor: c.border, color: c.text }]}
                  placeholder={`${AI_MODEL_INFO[aiProvider].name} API 키를 입력하세요`}
                  placeholderTextColor={c.textLight}
                  value={aiApiKeyInput}
                  onChangeText={setAiApiKeyInput}
                  secureTextEntry
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <Pressable
                  style={[
                    styles.apiKeySaveButton,
                    { backgroundColor: aiApiKeyInput.trim() ? c.primary : c.divider },
                  ]}
                  onPress={handleAISaveKey}
                  disabled={isAiKeySaving || !aiApiKeyInput.trim()}
                >
                  <Text style={styles.apiKeySaveText}>
                    {isAiKeySaving ? '저장 중' : '저장'}
                  </Text>
                </Pressable>
              </View>
              {aiApiKey ? (
                <Text style={[styles.apiKeyStatus, { color: c.status.safe }]}>
                  ✅ API 키 등록됨 - OCR 사용 가능
                </Text>
              ) : (
                <Text style={[styles.apiKeyStatus, { color: c.status.warn }]}>
                  ⚠️ API 키를 입력해주세요
                </Text>
              )}
            </View>
          )}
        </View>
        <Text style={[styles.aiNote, { color: c.textLight }]}>
          🔒 API 키는 기기 내 로컬(SQLite)에만 저장됩니다.{'\n'}
          💡 OCR 기능만 사용하며, 다른 용도로는 사용되지 않습니다.
        </Text>
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
  apiKeySection: { padding: 14, borderBottomWidth: 1, gap: 8 },
  apiKeyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  apiKeyLink: { flex: 1, fontSize: 11, textAlign: 'right' },
  apiKeyInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  apiKeyInput: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  apiKeySaveButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  apiKeySaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  apiKeyStatus: { fontSize: 12, fontWeight: '600' },
  aiNote: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  // AI 추천 배너 스타일
  recommendBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  recommendTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  recommendDesc: {
    fontSize: 12,
  },
  aiProviderInfo: {
    flex: 1,
  },
  aiModelSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
