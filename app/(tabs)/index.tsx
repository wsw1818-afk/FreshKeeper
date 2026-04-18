import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Vibration, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useFoodStore, useDashboardStats, useItemsWithStatus } from '@/hooks/useFoodStore';
import { FOOD_CATEGORY_LABEL, STORAGE_LOCATION_LABEL, DerivedStatus } from '@/types';
import type { FoodCategory } from '@/types';
import { useColors } from '@/hooks/useColors';
import StatusBadge from '@/components/StatusBadge';
import { getOutcomeStats, type OutcomeStats } from '@/lib/repository';

export default function HomeScreen() {
  const router = useRouter();
  const c = useColors();
  const items = useFoodStore((s) => s.items);
  const stats = useDashboardStats();
  const itemsWithStatus = useItemsWithStatus();
  const [outcomeStats, setOutcomeStats] = useState<OutcomeStats | null>(null);
  const searchQuery = useFoodStore((s) => s.globalSearchQuery);
  const setSearchQuery = useFoodStore((s) => s.setGlobalSearchQuery);

  useEffect(() => {
    getOutcomeStats().then(setOutcomeStats).catch(() => { });
  }, [items]);

  // 보관 장소별 현황
  const locationSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (!item.consumed_at) {
        map[item.location] = (map[item.location] || 0) + 1;
      }
    }
    const labels: Record<string, { icon: string; label: string }> = {
      FRIDGE: { icon: '🧊', label: '냉장' },
      FREEZER: { icon: '❄️', label: '냉동' },
      PANTRY: { icon: '🏠', label: '실온' },
      KIMCHI_FRIDGE: { icon: '🫙', label: '김치냉' },
    };
    return Object.entries(map)
      .map(([loc, count]) => ({ ...labels[loc] ?? { icon: '📦', label: loc }, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // 보관 장소별 식재료 그룹화
  const storageLocations = useFoodStore((s) => s.storageLocations);
  const loadStorageLocations = useFoodStore((s) => s.loadStorageLocations);

  useEffect(() => {
    loadStorageLocations();
  }, []);

  const itemsByLocation = useMemo(() => {
    const grouped: Record<string, typeof itemsWithStatus> = {};
    for (const location of storageLocations) {
      grouped[location.id] = itemsWithStatus
        .filter((item) => item.location === location.id && !item.consumed_at)
        .sort((a, b) => (a.dDay ?? 999) - (b.dDay ?? 999));
    }
    return grouped;
  }, [itemsWithStatus, storageLocations]);

  // 카테고리별 보관 현황
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (!item.consumed_at) {
        map[item.category] = (map[item.category] || 0) + 1;
      }
    }
    return Object.entries(map)
      .map(([cat, count]) => ({ category: cat, label: FOOD_CATEGORY_LABEL[cat as FoodCategory] ?? cat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  // 소비 팁 생성
  const smartTip = useMemo(() => {
    if (stats.expired > 0) return { icon: '⚠️', text: `만료된 식재료 ${stats.expired}개가 있습니다. 빠른 처리를 권장합니다.`, color: c.status.danger };
    if (stats.danger > 0) return { icon: '⏰', text: `오늘 만료되는 식재료 ${stats.danger}개! 오늘 소비해보세요.`, color: c.status.warn };
    if (stats.warn > 0) return { icon: '📋', text: `만료 임박 식재료 ${stats.warn}개. 이번 주 식단에 포함해보세요.`, color: c.status.warn };
    if (stats.total > 0) return { icon: '✅', text: '모든 식재료가 신선합니다! 잘 관리하고 계시네요.', color: c.status.safe };
    return null;
  }, [stats, c]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return itemsWithStatus.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, itemsWithStatus]);

  // "빨리 먹어야 할 재료 TOP 3" — 자취생/주부/요리애호가 공통 핵심 정보
  const urgentItems = useMemo(() => {
    const priority: Record<string, number> = {
      [DerivedStatus.EXPIRED]: 0,
      [DerivedStatus.DANGER]: 1,
      [DerivedStatus.WARN]: 2,
    };
    return itemsWithStatus
      .filter((i) => !i.consumed_at && priority[i.status] !== undefined)
      .sort((a, b) => {
        const pa = priority[a.status] ?? 99;
        const pb = priority[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return (a.dDay ?? 999) - (b.dDay ?? 999);
      })
      .slice(0, 3);
  }, [itemsWithStatus]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <StatusBar barStyle="default" backgroundColor={c.background} />
      <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
        {/* 검색 결과 */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.searchResultCard, { backgroundColor: c.surface }]}
                  onPress={() => { setSearchQuery(''); router.push(`/item/${item.id}`); }}
                >
                  <View style={styles.searchResultLeft}>
                    <Text style={[styles.searchResultName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.searchResultMeta, { color: c.textSecondary }]} numberOfLines={1}>
                      {item.expires_at ?? '기한 미설정'}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} dDay={item.dDay} size="small" />
                </Pressable>
              ))
            ) : (
              <Text style={[styles.searchNoResult, { color: c.textSecondary }]}>검색 결과가 없습니다</Text>
            )}
          </View>
        )}

        {/* 빨리 먹어야 할 재료 TOP 3 (user 페르소나 합의: 3가지 프로필 공통 핵심 정보) */}
        {urgentItems.length > 0 && (
          <View style={styles.urgentSection}>
            <Text style={[styles.urgentSectionTitle, { color: c.text }]}>
              ⏰ 빨리 먹어야 해요
            </Text>
            {urgentItems.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.urgentCard, { backgroundColor: c.surface }]}
                onPress={() => router.push(`/item/${item.id}`)}
              >
                <View style={styles.urgentLeft}>
                  <Text style={[styles.urgentName, { color: c.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.urgentMeta, { color: c.textSecondary }]} numberOfLines={1}>
                    {STORAGE_LOCATION_LABEL[item.location] ?? item.location}
                    {item.expires_at
                      ? ` · ${item.dDay != null && item.dDay >= 0 ? `D-${item.dDay}` : `D+${Math.abs(item.dDay ?? 0)}`}`
                      : ' · 기한 미설정'}
                  </Text>
                </View>
                <StatusBadge status={item.status} dDay={item.dDay} size="small" />
              </Pressable>
            ))}
          </View>
        )}

        {/* 통계 카드 */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: c.surface }]}>
              <Text style={[styles.statCount, { color: c.primary }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>전체</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: c.surface }]}>
              <Text style={[styles.statCount, { color: c.status.expired }]}>{stats.expired}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>만료</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: c.surface }]}>
              <Text style={[styles.statCount, { color: c.status.danger }]}>{stats.danger}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>오늘</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: c.surface }]}>
              <Text style={[styles.statCount, { color: c.status.warn }]}>{stats.warn}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>임박</Text>
            </View>
          </View>
        </View>

        {/* 스마트 팁 */}
        {smartTip && (
          <View style={[styles.tipCard, { backgroundColor: c.surface }]}>
            <Text style={styles.tipIcon}>{smartTip.icon}</Text>
            <Text style={[styles.tipText, { color: smartTip.color }]}>{smartTip.text}</Text>
          </View>
        )}

        {/* 보관 장소별 현황 */}
        {locationSummary.length > 0 && (
          <View style={styles.locationRow}>
            {locationSummary.map((loc) => (
              <View key={loc.label} style={[styles.locationChip, { backgroundColor: c.surface }]}>
                <Text style={styles.locationIcon}>{loc.icon}</Text>
                <Text style={[styles.locationLabel, { color: c.textSecondary }]}>{loc.label}</Text>
                <Text style={[styles.locationCount, { color: c.text }]}>{loc.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 카테고리별 보관 현황 */}
        {categorySummary.length > 0 && (
          <Pressable
            style={[styles.categorySummaryCard, { backgroundColor: c.surface }]}
            onPress={() => router.push('/(tabs)/inventory')}
          >
            <Text style={[styles.categorySummaryTitle, { color: c.text }]}>카테고리별 보관</Text>
            <View style={styles.categorySummaryList}>
              {categorySummary.map((cat) => (
                <View key={cat.category} style={styles.categorySummaryItem}>
                  <Text style={[styles.categorySummaryLabel, { color: c.textSecondary }]}>{cat.label}</Text>
                  <Text style={[styles.categorySummaryCount, { color: c.text }]}>{cat.count}개</Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {/* 소비 통계 요약 */}
        {outcomeStats && outcomeStats.total > 0 && (
          <Pressable
            style={[styles.outcomeSummary, { backgroundColor: c.surface }]}
            onPress={() => router.push('/(tabs)/stats')}
          >
            <Text style={[styles.outcomeSummaryTitle, { color: c.text }]}>소비 현황</Text>
            <View style={styles.outcomeBarRow}>
              <View style={[styles.outcomeBar, { backgroundColor: c.border }]}>
                {outcomeStats.eat > 0 && (
                  <View style={[styles.outcomeSegment, { flex: outcomeStats.eat, backgroundColor: c.status.safe }]} />
                )}
                {outcomeStats.share > 0 && (
                  <View style={[styles.outcomeSegment, { flex: outcomeStats.share, backgroundColor: c.status.longTerm }]} />
                )}
                {outcomeStats.discard > 0 && (
                  <View style={[styles.outcomeSegment, { flex: outcomeStats.discard, backgroundColor: c.status.danger }]} />
                )}
              </View>
            </View>
            <View style={styles.outcomeLegend}>
              <Text style={[styles.outcomeLegendItem, { color: c.textSecondary }]}>
                <Text style={{ color: c.status.safe }}>● </Text>
                섭취 {Math.round((outcomeStats.eat / outcomeStats.total) * 100)}%
              </Text>
              <Text style={[styles.outcomeLegendItem, { color: c.textSecondary }]}>
                <Text style={{ color: c.status.danger }}>● </Text>
                폐기 {Math.round((outcomeStats.discard / outcomeStats.total) * 100)}%
              </Text>
            </View>
          </Pressable>
        )}

        {/* 빠른 등록 버튼 */}
        <Pressable
          style={[styles.quickAddButton, { backgroundColor: c.primary }]}
          onPress={() => { Vibration.vibrate(20); router.push('/(tabs)/add'); }}
          accessibilityLabel="식재료 등록하기"
          accessibilityHint="새 식재료를 등록하려면 탭하세요"
          accessibilityRole="button"
        >
          <Text style={styles.quickAddIcon}>➕</Text>
          <Text style={styles.quickAddText}>식재료 등록하기</Text>
        </Pressable>

        {/* 보관 장소별 식재료 리스트 */}
        {storageLocations.map((location) => {
          const locationItems = itemsByLocation[location.id] || [];
          if (locationItems.length === 0) return null;
          return (
            <View key={location.id} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                {location.icon} {location.name} ({locationItems.length})
              </Text>
              {locationItems.slice(0, 5).map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.fridgeCard, { backgroundColor: c.surface }]}
                  onPress={() => router.push(`/item/${item.id}`)}
                >
                  <View style={styles.fridgeLeft}>
                    <Text style={[styles.fridgeName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.fridgeMeta, { color: c.textSecondary }]} numberOfLines={1}>
                      {STORAGE_LOCATION_LABEL[item.location]}
                      {item.expires_at ? ` · D${item.dDay != null ? (item.dDay >= 0 ? `+${item.dDay}` : `${item.dDay}`) : '?'}` : ' · 기한 미설정'}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} dDay={item.dDay} size="small" />
                </Pressable>
              ))}
              {locationItems.length > 5 && (
                <Pressable onPress={() => router.push('/(tabs)/inventory')}>
                  <Text style={[styles.moreLink, { color: c.primary }]}>
                    +{locationItems.length - 5}개 더 보기
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* 빈 상태 */}
        {items.length === 0 && (
          <View style={styles.emptyUrgent}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={[styles.emptyText, { color: c.text }]}>아직 등록된 식재료가 없어요</Text>
            <Text style={[styles.emptySubText, { color: c.textSecondary }]}>
              냉장고에 있는 첫 식재료를 등록하면{'\n'}
              유통기한 알림과 신선도를 자동으로 관리해드려요
            </Text>
            <Pressable
              style={[styles.emptyCta, { backgroundColor: c.primary }]}
              onPress={() => { Vibration.vibrate(20); router.push('/(tabs)/add'); }}
              accessibilityLabel="첫 식재료 등록하기"
              accessibilityRole="button"
            >
              <Text style={styles.emptyCtaText}>➕ 첫 식재료 등록하기</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: { flex: 1 },
  content: { paddingBottom: 20 },
  searchResults: { paddingHorizontal: 12, paddingTop: 6, gap: 4 },
  searchResultCard: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  searchResultLeft: { flex: 1, overflow: 'hidden', marginRight: 12 },
  searchResultName: { fontSize: 14, fontWeight: '600' },
  searchResultMeta: { fontSize: 12, marginTop: 2 },
  searchNoResult: { textAlign: 'center', paddingVertical: 12, fontSize: 13 },
  urgentSection: { marginHorizontal: 12, marginTop: 8, gap: 6 },
  urgentSectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4, marginLeft: 2 },
  urgentCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  urgentLeft: { flex: 1, overflow: 'hidden', marginRight: 12, gap: 2 },
  urgentName: { fontSize: 15, fontWeight: '700' },
  urgentMeta: { fontSize: 12 },
  statsContainer: { paddingHorizontal: 12, paddingTop: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, minWidth: 80, borderRadius: 10, padding: 12, alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  statCount: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4 },
  quickAddButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 10, gap: 8,
  },
  quickAddIcon: { fontSize: 18, color: '#fff' },
  quickAddText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  section: { marginTop: 10, paddingHorizontal: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  moreLink: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  emptyUrgent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 17, fontWeight: '700' },
  emptySubText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    marginTop: 16, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8,
    padding: 12, borderRadius: 9, gap: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  tipIcon: { fontSize: 18 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500' },
  locationRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  locationChip: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, gap: 4,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  locationIcon: { fontSize: 14 },
  locationCount: { fontSize: 13, fontWeight: '700' },
  locationLabel: { fontSize: 12 },
  categorySummaryCard: {
    marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  categorySummaryTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  categorySummaryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categorySummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 80 },
  categorySummaryLabel: { fontSize: 13 },
  categorySummaryCount: { fontSize: 13, fontWeight: '700' },
  outcomeSummary: {
    marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  outcomeSummaryTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  outcomeBarRow: { marginBottom: 10 },
  outcomeBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  outcomeSegment: { height: '100%' },
  outcomeLegend: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 },
  outcomeLegendItem: { fontSize: 12 },
  fridgeCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 10, marginBottom: 6,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  fridgeLeft: { flex: 1, overflow: 'hidden', marginRight: 12, gap: 4 },
  fridgeName: { fontSize: 15, fontWeight: '600' },
  fridgeMeta: { fontSize: 12, marginTop: 2 },
});
