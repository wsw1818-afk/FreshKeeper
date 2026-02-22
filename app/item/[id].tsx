import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useFoodStore } from '@/hooks/useFoodStore';
import type { FoodItem } from '@/types';
import {
  StorageLocation, Outcome, DerivedStatus,
  STORAGE_LOCATION_LABEL, STORAGE_LOCATION_ICON,
  FOOD_CATEGORY_LABEL, DATE_TYPE_LABEL, DERIVED_STATUS_LABEL,
} from '@/types';
import { useColors } from '@/hooks/useColors';
import { calculateStatus } from '@/lib/statusCalculator';
import { formatDisplayDate, formatDDay, getToday, isValidDateString, calculateExpiryDate, recalculateAfterOpen, recalculateAfterThaw } from '@/lib/dateUtils';
import StatusBadge from '@/components/StatusBadge';
import ImagePickerButton from '@/components/ImagePickerButton';

type ViewMode = 'detail' | 'edit';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useColors();
  const items = useFoodStore((s) => s.items);
  const editItem = useFoodStore((s) => s.editItem);
  const consumeItem = useFoodStore((s) => s.consumeItem);
  const removeItem = useFoodStore((s) => s.removeItem);

  const templates = useFoodStore((s) => s.templates);
  const storeItem = items.find((i) => i.id === id);
  const cachedItemRef = useRef<FoodItem | undefined>(undefined);
  if (storeItem) {
    cachedItemRef.current = storeItem;
  }
  // 소비/삭제 후 스토어에서 제거되어도 캐시된 데이터로 화면 유지 (하얀 잔상 방지)
  const item = storeItem ?? cachedItemRef.current;

  const [viewMode, setViewMode] = useState<ViewMode>('detail');

  // 편집 상태
  const [editName, setEditName] = useState('');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState<string>(StorageLocation.FRIDGE);
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMemo, setEditMemo] = useState('');

  useEffect(() => {
    if (item) {
      setEditName(item.name);
      setEditImageUri(item.image_uri);
      setEditLocation(item.location);
      setEditExpiresAt(item.expires_at ?? '');
      setEditQuantity(String(item.quantity));
      setEditUnit(item.unit);
      setEditMemo(item.memo ?? '');
    }
  }, [item?.id]);

  if (!item) {
    return (
      <>
        <Stack.Screen options={{ title: '항목 없음', headerShown: true }} />
        <View style={[styles.notFound, { backgroundColor: c.background }]}>
          <Text style={[styles.notFoundText, { color: c.textSecondary }]}>식재료를 찾을 수 없습니다.</Text>
          <Pressable style={[styles.backButton, { backgroundColor: c.primary }]} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const { status, dDay } = calculateStatus(item);
  const statusKey = status.toLowerCase() as keyof typeof c.status;
  const statusColor = c.status[statusKey] ?? c.status.expired;

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('알림', '식재료 이름을 입력해주세요.');
      return;
    }
    if (editExpiresAt.trim() && !isValidDateString(editExpiresAt)) {
      Alert.alert('알림', '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)');
      return;
    }

    try {
      await editItem(item.id, {
        name: editName.trim(),
        image_uri: editImageUri,
        location: editLocation,
        expires_at: editExpiresAt.trim() || null,
        quantity: parseFloat(editQuantity) || 1,
        unit: editUnit || '개',
        memo: editMemo.trim() || null,
      });
      setViewMode('detail');
    } catch (e) {
      Alert.alert('오류', '수정에 실패했습니다.');
    }
  };

  const handleConsume = async (outcome: Outcome) => {
    // 먼저 화면 전환 (캐시된 데이터로 애니메이션 중 화면 유지)
    router.back();
    await consumeItem(item.id, outcome);
  };

  const handleDelete = async () => {
    // 먼저 화면 전환 (캐시된 데이터로 애니메이션 중 화면 유지)
    router.back();
    await removeItem(item.id);
  };

  const handlePartialUse = () => {
    // 수량 > 1 일 때만 동작
    if (item.quantity <= 1) return;
    Alert.alert(
      '부분 사용',
      `현재 수량: ${item.quantity}${item.unit}\n사용할 양을 선택하세요.`,
      [
        { text: '취소', style: 'cancel' },
        ...[0.25, 0.5, 1].filter((v) => v < item.quantity).map((v) => ({
          text: `${v}${item.unit} 사용`,
          onPress: async () => {
            const newQty = Math.round((item.quantity - v) * 100) / 100;
            if (newQty <= 0) {
              handleConsume(Outcome.EAT);
            } else {
              await editItem(item.id, { quantity: newQty });
              Alert.alert('수량 변경', `${v}${item.unit} 사용 → 남은 수량: ${newQty}${item.unit}`);
            }
          },
        })),
      ],
    );
  };

  const handleMarkOpened = async () => {
    const today = getToday();
    const updates: Partial<FoodItem> = { opened_at: today };
    if (item.freshness_days_after_open) {
      updates.expires_at = recalculateAfterOpen(
        item.expires_at,
        today,
        item.freshness_days_after_open,
      );
    }
    await editItem(item.id, updates);
    Alert.alert('개봉 처리', updates.expires_at
      ? `소비기한이 ${formatDisplayDate(updates.expires_at)}(으)로 갱신되었습니다.`
      : '개봉일이 기록되었습니다.');
  };

  const handleMarkThawed = async () => {
    const today = getToday();
    const updates: Partial<FoodItem> = { thawed_at: today };
    const template = templates.find((t) => t.id === item.template_id);
    if (template?.after_thaw_days) {
      updates.expires_at = recalculateAfterThaw(today, template.after_thaw_days);
    }
    await editItem(item.id, updates);
    Alert.alert('해동 처리', updates.expires_at
      ? `소비기한이 ${formatDisplayDate(updates.expires_at)}(으)로 갱신되었습니다.`
      : '해동일이 기록되었습니다.');
  };

  if (viewMode === 'edit') {
    return (
      <>
        <Stack.Screen options={{ title: '편집', headerShown: true }} />
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: c.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.editContent}>
            <View style={styles.editNameImageRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.text }]}>식재료 이름 *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.label, { color: c.text }]}>사진</Text>
                <ImagePickerButton imageUri={editImageUri} onImageSelected={setEditImageUri} size="small" />
              </View>
            </View>

            <Text style={[styles.label, { color: c.text }]}>보관 위치</Text>
            <View style={styles.locationRow}>
              {Object.values(StorageLocation).map((loc) => (
                <Pressable
                  key={loc}
                  style={[
                    styles.locChip,
                    { backgroundColor: c.surface, borderColor: c.border },
                    editLocation === loc && { borderColor: c.primary, backgroundColor: c.statusBg.safe },
                  ]}
                  onPress={() => setEditLocation(loc)}
                >
                  <Text style={styles.locIcon}>{STORAGE_LOCATION_ICON[loc]}</Text>
                  <Text style={[styles.locText, { color: c.textSecondary }, editLocation === loc && { color: c.primary, fontWeight: '600' as const }]}>
                    {STORAGE_LOCATION_LABEL[loc]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: c.text }]}>소비기한</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textLight}
              value={editExpiresAt}
              onChangeText={setEditExpiresAt}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.quickDateRow}>
              {[
                { label: '오늘', days: 0 },
                { label: '+3일', days: 3 },
                { label: '+1주', days: 7 },
                { label: '+2주', days: 14 },
                { label: '+1달', days: 30 },
              ].map((opt) => (
                <Pressable
                  key={opt.label}
                  style={[styles.quickDateChip, { backgroundColor: c.surface, borderColor: c.border }]}
                  onPress={() => setEditExpiresAt(calculateExpiryDate(getToday(), opt.days))}
                >
                  <Text style={[styles.quickDateText, { color: c.primary }]}>{opt.label}</Text>
                </Pressable>
              ))}
              {editExpiresAt ? (
                <Pressable
                  style={[styles.quickDateChip, { backgroundColor: c.surface, borderColor: c.error }]}
                  onPress={() => setEditExpiresAt('')}
                >
                  <Text style={[styles.quickDateText, { color: c.error }]}>초기화</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.quantityRow}>
              <View style={styles.quantityField}>
                <Text style={[styles.label, { color: c.text }]}>수량</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  value={editQuantity}
                  onChangeText={setEditQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.unitField}>
                <Text style={[styles.label, { color: c.text }]}>단위</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  value={editUnit}
                  onChangeText={setEditUnit}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: c.text }]}>메모</Text>
            <TextInput
              style={[styles.input, styles.memoInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              placeholder="메모를 입력하세요"
              placeholderTextColor={c.textLight}
              value={editMemo}
              onChangeText={setEditMemo}
              multiline
            />

            <View style={styles.editActions}>
              <Pressable style={[styles.saveButton, { backgroundColor: c.primary }]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>저장</Text>
              </Pressable>
              <Pressable style={[styles.cancelButton, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setViewMode('detail')}>
                <Text style={[styles.cancelButtonText, { color: c.textSecondary }]}>취소</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: item.name, headerShown: true }} />
      <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.detailContent}>
        {/* 상태 헤더 */}
        <View style={[styles.statusHeader, { backgroundColor: statusColor + '15' }]}>
          <StatusBadge status={status} dDay={dDay} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {DERIVED_STATUS_LABEL[status]}
          </Text>
        </View>

        {/* 이미지 */}
        {item.image_uri && (
          <View style={styles.imageSection}>
            <Image source={{ uri: item.image_uri }} style={styles.itemImage} />
          </View>
        )}

        {/* 위험도 프로그레스 바 */}
        {item.expires_at && dDay !== null && (
          <View style={styles.progressSection}>
            <FreshnessBar dDay={dDay} freshnessdays={item.freshness_days} />
          </View>
        )}

        {/* 기본 정보 */}
        <View style={[styles.infoSection, { backgroundColor: c.surface }]}>
          <InfoRow label="이름" value={item.name} />
          <InfoRow label="카테고리" value={FOOD_CATEGORY_LABEL[item.category]} />
          <InfoRow
            label="보관 위치"
            value={`${STORAGE_LOCATION_ICON[item.location]} ${STORAGE_LOCATION_LABEL[item.location]}`}
          />
          <InfoRow label="수량" value={`${item.quantity} ${item.unit}`} />
          <InfoRow label="기한 유형" value={DATE_TYPE_LABEL[item.date_type]} />
          <InfoRow
            label="소비기한"
            value={item.expires_at ? formatDisplayDate(item.expires_at) : '미설정'}
          />
          <InfoRow label="등록일" value={formatDisplayDate(item.added_at)} />
          {item.opened_at && (
            <InfoRow label="개봉일" value={formatDisplayDate(item.opened_at)} />
          )}
          {item.thawed_at && (
            <InfoRow label="해동일" value={formatDisplayDate(item.thawed_at)} />
          )}
          {item.memo && <InfoRow label="메모" value={item.memo} />}
        </View>

        {/* 빠른 액션 */}
        <View style={styles.quickActions}>
          {!item.opened_at && (
            <Pressable style={[styles.quickActionButton, { backgroundColor: c.surface, borderColor: c.border }]} onPress={handleMarkOpened}>
              <Text style={styles.quickActionIcon}>📦</Text>
              <Text style={[styles.quickActionText, { color: c.text }]}>개봉 처리</Text>
            </Pressable>
          )}
          {!item.thawed_at && item.location === StorageLocation.FREEZER && (
            <Pressable style={[styles.quickActionButton, { backgroundColor: c.surface, borderColor: c.border }]} onPress={handleMarkThawed}>
              <Text style={styles.quickActionIcon}>🧊</Text>
              <Text style={[styles.quickActionText, { color: c.text }]}>해동 처리</Text>
            </Pressable>
          )}
          {item.quantity > 1 && (
            <Pressable style={[styles.quickActionButton, { backgroundColor: c.surface, borderColor: c.border }]} onPress={handlePartialUse}>
              <Text style={styles.quickActionIcon}>✂️</Text>
              <Text style={[styles.quickActionText, { color: c.text }]}>부분 사용</Text>
            </Pressable>
          )}
        </View>

        {/* 소비 액션 */}
        <View style={styles.consumeActions}>
          <Pressable
            style={[styles.consumeButton, { backgroundColor: c.status.safe }]}
            onPress={() => handleConsume(Outcome.EAT)}
          >
            <Text style={styles.consumeIcon}>😋</Text>
            <Text style={styles.consumeText}>먹음</Text>
          </Pressable>
          <Pressable
            style={[styles.consumeButton, { backgroundColor: c.status.danger }]}
            onPress={() => handleConsume(Outcome.DISCARD)}
          >
            <Text style={styles.consumeIcon}>🗑️</Text>
            <Text style={styles.consumeText}>폐기</Text>
          </Pressable>
        </View>

        {/* 편집/삭제 */}
        <View style={styles.bottomActions}>
          <Pressable style={[styles.editButton, { backgroundColor: c.surface, borderColor: c.primary }]} onPress={() => setViewMode('edit')}>
            <Text style={[styles.editButtonText, { color: c.primary }]}>편집</Text>
          </Pressable>
          <Pressable style={[styles.deleteButton, { backgroundColor: c.surface, borderColor: c.error }]} onPress={handleDelete}>
            <Text style={[styles.deleteButtonText, { color: c.error }]}>삭제</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

// 신선도 프로그레스 바 컴포넌트
function FreshnessBar({ dDay, freshnessdays }: { dDay: number; freshnessdays: number | null }) {
  const c = useColors();
  const totalDays = freshnessdays ?? 7;
  const elapsed = totalDays - dDay;
  const ratio = Math.max(0, Math.min(1, elapsed / totalDays));
  const freshness = (1 - ratio) * 100;

  // 신선도 퍼센트 기반 색상 (100%=초록, 낮아질수록 빨강)
  let barColor = c.status.safe;
  if (dDay <= 0) barColor = c.status.expired;
  else if (freshness <= 30) barColor = c.status.danger;
  else if (freshness <= 60) barColor = c.status.warn;

  return (
    <View style={freshnessStyles.container}>
      <View style={freshnessStyles.labelRow}>
        <Text style={[freshnessStyles.labelText, { color: c.textSecondary }]}>신선도</Text>
        <Text style={[freshnessStyles.valueText, { color: barColor }]}>
          {dDay <= 0 ? '만료' : `${Math.round(freshness)}%`}
        </Text>
      </View>
      <View style={[freshnessStyles.barBg, { backgroundColor: c.divider }]}>
        <View style={[freshnessStyles.barFill, { width: `${freshness}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: c.divider }]}>
      <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const freshnessStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  labelText: { fontSize: 13, fontWeight: '600' },
  valueText: { fontSize: 13, fontWeight: '700' },
  barBg: { height: 8, borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  detailContent: { paddingBottom: 32 },
  imageSection: { alignItems: 'center', marginHorizontal: 16, marginTop: 12 },
  itemImage: { width: 120, height: 120, borderRadius: 12 },
  editNameImageRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  editContent: { padding: 16, paddingBottom: 32 },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  notFoundText: { fontSize: 16 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#fff', fontWeight: '600' },
  statusHeader: {
    alignItems: 'center', paddingVertical: 24, gap: 8,
    marginHorizontal: 16, marginTop: 16, borderRadius: 16,
  },
  statusLabel: { fontSize: 18, fontWeight: '700' },
  dDayText: { fontSize: 14 },
  progressSection: { marginTop: 8 },
  infoSection: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '500', flex: 2, textAlign: 'right' },
  quickActions: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: 16,
  },
  quickActionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 12, gap: 6, borderWidth: 1,
  },
  quickActionIcon: { fontSize: 18 },
  quickActionText: { fontSize: 14, fontWeight: '600' },
  consumeActions: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: 16,
  },
  consumeButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 4,
  },
  consumeIcon: { fontSize: 20 },
  consumeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bottomActions: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: 16,
  },
  editButton: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  editButtonText: { fontSize: 15, fontWeight: '600' },
  deleteButton: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  // 편집 모드 스타일
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1,
  },
  memoInput: { minHeight: 80, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  locChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, gap: 4,
  },
  locIcon: { fontSize: 16 },
  locText: { fontSize: 13 },
  quickDateRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  quickDateChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  quickDateText: { fontSize: 12, fontWeight: '600' },
  quantityRow: { flexDirection: 'row', gap: 12 },
  quantityField: { flex: 2 },
  unitField: { flex: 1 },
  editActions: { gap: 8, marginTop: 20 },
  saveButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelButton: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1,
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
});
