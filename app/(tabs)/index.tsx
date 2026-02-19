import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Vibration } from 'react-native';
import { useRouter } from 'expo-router';
import { useFoodStore, useDashboardStats, useItemsWithStatus } from '@/hooks/useFoodStore';
import { DerivedStatus, FOOD_CATEGORY_LABEL } from '@/types';
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

  const urgentItems = itemsWithStatus
    .filter((i) => i.status === DerivedStatus.EXPIRED || i.status === DerivedStatus.DANGER || i.status === DerivedStatus.WARN)
    .sort((a, b) => (a.dDay ?? 999) - (b.dDay ?? 999));

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
      ROOM: { icon: '🏠', label: '실온' },
      KIMCHI_FRIDGE: { icon: '🫙', label: '김치냉장고' },
    };
    return Object.entries(map)
      .map(([loc, count]) => ({ ...labels[loc] ?? { icon: '📦', label: loc }, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

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
    if (stats.expired > 0) return { icon: '⚠️', text: `만료된 식재료 ${stats.expired}개가 있습니다. 빠른 처리를 권장합니다.`, color: '#F44336' };
    if (stats.danger > 0) return { icon: '⏰', text: `오늘 만료되는 식재료 ${stats.danger}개! 오늘 소비해보세요.`, color: '#FF9800' };
    if (stats.warn > 0) return { icon: '📋', text: `만료 임박 식재료 ${stats.warn}개. 이번 주 식단에 포함해보세요.`, color: '#FF9800' };
    if (stats.total > 0) return { icon: '✅', text: '모든 식재료가 신선합니다! 잘 관리하고 계시네요.', color: '#4CAF50' };
    return null;
  }, [stats]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return itemsWithStatus.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, itemsWithStatus]);

  return (
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
                  <Text style={[styles.searchResultName, { color: c.text }]}>{item.name}</Text>
                  <Text style={[styles.searchResultMeta, { color: c.textSecondary }]}>
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
              <Text style={[styles.locationCount, { color: c.text }]}>{loc.count}</Text>
              <Text style={[styles.locationLabel, { color: c.textSecondary }]}>{loc.label}</Text>
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
                <View style={[styles.outcomeSegment, { flex: outcomeStats.eat, backgroundColor: '#4CAF50' }]} />
              )}
              {outcomeStats.share > 0 && (
                <View style={[styles.outcomeSegment, { flex: outcomeStats.share, backgroundColor: '#2196F3' }]} />
              )}
              {outcomeStats.discard > 0 && (
                <View style={[styles.outcomeSegment, { flex: outcomeStats.discard, backgroundColor: '#F44336' }]} />
              )}
            </View>
          </View>
          <View style={styles.outcomeLegend}>
            <Text style={[styles.outcomeLegendItem, { color: c.textSecondary }]}>
              <Text style={{ color: '#4CAF50' }}>● </Text>
              섭취 {Math.round((outcomeStats.eat / outcomeStats.total) * 100)}%
            </Text>
            <Text style={[styles.outcomeLegendItem, { color: c.textSecondary }]}>
              <Text style={{ color: '#2196F3' }}>● </Text>
              나눔 {Math.round((outcomeStats.share / outcomeStats.total) * 100)}%
            </Text>
            <Text style={[styles.outcomeLegendItem, { color: c.textSecondary }]}>
              <Text style={{ color: '#F44336' }}>● </Text>
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

      {/* 긴급 알림 리스트 */}
      {urgentItems.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            주의가 필요한 식재료 ({urgentItems.length})
          </Text>
          {urgentItems.slice(0, 10).map((item) => (
            <Pressable
              key={item.id}
              style={[styles.urgentCard, { backgroundColor: c.surface }]}
              onPress={() => router.push(`/item/${item.id}`)}
            >
              <View style={styles.urgentLeft}>
                <Text style={[styles.urgentName, { color: c.text }]}>{item.name}</Text>
                <Text style={[styles.urgentMeta, { color: c.textSecondary }]}>
                  {item.expires_at ? `${item.expires_at}` : '기한 미설정'}
                </Text>
              </View>
              <StatusBadge status={item.status} dDay={item.dDay} size="small" />
            </Pressable>
          ))}
          {urgentItems.length > 10 && (
            <Pressable onPress={() => router.push('/(tabs)/inventory')}>
              <Text style={[styles.moreLink, { color: c.primary }]}>
                +{urgentItems.length - 10}개 더 보기
              </Text>
            </Pressable>
          )}
        </View>
      ) : items.length > 0 ? (
        <View style={styles.emptyUrgent}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={[styles.emptyText, { color: c.text }]}>모든 식재료가 안전합니다!</Text>
        </View>
      ) : (
        <View style={styles.emptyUrgent}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={[styles.emptyText, { color: c.text }]}>등록된 식재료가 없습니다</Text>
          <Text style={[styles.emptySubText, { color: c.textSecondary }]}>아래 버튼으로 첫 식재료를 등록해보세요</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 24 },
  searchResults: { paddingHorizontal: 16, paddingTop: 8, gap: 6 },
  searchResultCard: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  searchResultLeft: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: '600' },
  searchResultMeta: { fontSize: 11, marginTop: 2 },
  searchNoResult: { textAlign: 'center', paddingVertical: 16, fontSize: 14 },
  statsContainer: { paddingHorizontal: 16, paddingTop: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, borderRadius: 12, padding: 12, alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  statCount: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  quickAddButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, gap: 8,
  },
  quickAddIcon: { fontSize: 20, color: '#fff' },
  quickAddText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  urgentCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  urgentLeft: { flex: 1 },
  urgentName: { fontSize: 15, fontWeight: '600' },
  urgentMeta: { fontSize: 12, marginTop: 2 },
  moreLink: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  emptyUrgent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubText: { fontSize: 14 },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12,
    padding: 12, borderRadius: 10, gap: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  tipIcon: { fontSize: 20 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  locationRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  locationChip: {
    flex: 1, alignItems: 'center', padding: 10, borderRadius: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  locationIcon: { fontSize: 20 },
  locationCount: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  locationLabel: { fontSize: 11, marginTop: 1 },
  categorySummaryCard: {
    marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  categorySummaryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  categorySummaryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categorySummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categorySummaryLabel: { fontSize: 12 },
  categorySummaryCount: { fontSize: 12, fontWeight: '700' },
  outcomeSummary: {
    marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  outcomeSummaryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  outcomeBarRow: { marginBottom: 8 },
  outcomeBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  outcomeSegment: { height: '100%' },
  outcomeLegend: { flexDirection: 'row', justifyContent: 'space-around' },
  outcomeLegendItem: { fontSize: 12 },
});
