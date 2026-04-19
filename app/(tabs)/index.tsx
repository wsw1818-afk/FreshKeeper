import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Vibration, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useFoodStore, useDashboardStats, useItemsWithStatus } from '@/hooks/useFoodStore';
import { STORAGE_LOCATION_LABEL, DerivedStatus } from '@/types';
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

  // [Council Round 3 합의 P1-4] categorySummary 죽은 코드 제거 (A1 미니멀 리팩터링 후 미사용)

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

        {/* [A1 미니멀 집중형] 빨리 먹어야 해요 — 대형 히어로 섹션 */}
        {urgentItems.length > 0 && (
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: c.text }]}>
              ⏰ 빨리 먹어야 해요
            </Text>
            <Text style={[styles.heroSubtitle, { color: c.textSecondary }]}>
              가장 급한 식재료 {urgentItems.length}개
            </Text>
            {urgentItems.map((item, idx) => (
              <Pressable
                key={item.id}
                style={[
                  styles.heroCard,
                  { backgroundColor: c.surface, borderLeftColor: idx === 0 ? c.status.danger : idx === 1 ? c.status.warn : c.status.safe },
                ]}
                onPress={() => router.push(`/item/${item.id}`)}
              >
                <View style={styles.heroCardLeft}>
                  <Text style={[styles.heroCardName, { color: c.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.heroCardMeta, { color: c.textSecondary }]} numberOfLines={1}>
                    {STORAGE_LOCATION_LABEL[item.location] ?? item.location}
                  </Text>
                </View>
                <View style={styles.heroCardRight}>
                  <Text
                    style={[
                      styles.heroCardDDay,
                      { color: idx === 0 ? c.status.danger : idx === 1 ? c.status.warn : c.status.safe },
                    ]}
                  >
                    {item.expires_at && item.dDay != null
                      ? item.dDay >= 0 ? `D-${item.dDay}` : `D+${Math.abs(item.dDay)}`
                      : '—'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* [A1 미니멀 집중형] 컴팩트 4단 통계 — 위험 카드 다음에 최소화된 정보 */}
        <View style={styles.miniStatsRow}>
          <View style={styles.miniStat}>
            <Text style={[styles.miniStatCount, { color: c.text }]}>{stats.total}</Text>
            <Text style={[styles.miniStatLabel, { color: c.textSecondary }]}>전체</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={[styles.miniStatCount, { color: stats.expired > 0 ? c.status.expired : c.text }]}>{stats.expired}</Text>
            <Text style={[styles.miniStatLabel, { color: c.textSecondary }]}>만료</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={[styles.miniStatCount, { color: stats.danger > 0 ? c.status.danger : c.text }]}>{stats.danger}</Text>
            <Text style={[styles.miniStatLabel, { color: c.textSecondary }]}>오늘</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={[styles.miniStatCount, { color: stats.warn > 0 ? c.status.warn : c.text }]}>{stats.warn}</Text>
            <Text style={[styles.miniStatLabel, { color: c.textSecondary }]}>임박</Text>
          </View>
        </View>

        {/* [A1 미니멀 집중형] 보관 위치 필터 — 가로 칩 한 줄 */}
        {locationSummary.length > 0 && (
          <View style={styles.locationRow}>
            {locationSummary.map((loc) => (
              <Pressable
                key={loc.label}
                style={[styles.locationChip, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => router.push('/(tabs)/inventory')}
              >
                <Text style={styles.locationIcon}>{loc.icon}</Text>
                <Text style={[styles.locationLabel, { color: c.textSecondary }]}>{loc.label}</Text>
                <Text style={[styles.locationCount, { color: c.text }]}>{loc.count}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* [A1 미니멀 집중형] 스마트 팁 (한 줄, 있을 때만) */}
        {smartTip && stats.expired === 0 && (
          <View style={[styles.tipCardMinimal, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={styles.tipIcon}>{smartTip.icon}</Text>
            <Text style={[styles.tipText, { color: smartTip.color }]} numberOfLines={2}>{smartTip.text}</Text>
          </View>
        )}

        {/* [Council Round 3 합의 P0-2] 소비 통계 — 의미 있는 데이터 (5건+) 일 때만 백분율, 그 미만은 건수만 표시 */}
        {outcomeStats && outcomeStats.total >= 5 && (
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
        {/* 데이터 1~4건: 백분율 대신 건수만 표시 (designer 권고: 희소 상태에서 비율은 정보를 과장함) */}
        {outcomeStats && outcomeStats.total > 0 && outcomeStats.total < 5 && (
          <Pressable
            style={[styles.outcomeSummary, { backgroundColor: c.surface }]}
            onPress={() => router.push('/(tabs)/stats')}
          >
            <Text style={[styles.outcomeSummaryTitle, { color: c.text }]}>소비 기록</Text>
            <View style={styles.outcomeCountRow}>
              <Text style={[styles.outcomeCountItem, { color: c.status.safe }]}>😋 먹음 {outcomeStats.eat}건</Text>
              {outcomeStats.discard > 0 && (
                <Text style={[styles.outcomeCountItem, { color: c.status.danger }]}>🗑 폐기 {outcomeStats.discard}건</Text>
              )}
            </View>
            <Text style={[styles.outcomeCountHint, { color: c.textLight }]}>
              5건 이상 쌓이면 비율 분석이 시작돼요
            </Text>
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

        {/* [D1 캐릭터 히어로] 빈 상태 */}
        {items.length === 0 && (
          <View style={styles.emptyHero}>
            <View style={[styles.emptyCharacter, { backgroundColor: c.statusBg.safe }]}>
              <Text style={styles.emptyCharacterIcon}>🧊</Text>
              <Text style={styles.emptyCharacterFace}>◡ ◡</Text>
            </View>
            <Text style={[styles.emptyHeroTitle, { color: c.text }]}>냉장고가 비어있어요</Text>
            <Text style={[styles.emptyHeroSubtitle, { color: c.textSecondary }]}>
              첫 식재료를 등록하면{'\n'}유통기한과 신선도를 관리해드려요
            </Text>

            {/* 3단계 온보딩 가이드 */}
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumber, { backgroundColor: c.primary }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: c.text }]}>식재료 등록</Text>
                  <Text style={[styles.stepDesc, { color: c.textSecondary }]}>템플릿, 영수증 스캔, 직접 입력</Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumber, { backgroundColor: c.primaryLight }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: c.text }]}>자동 알림</Text>
                  <Text style={[styles.stepDesc, { color: c.textSecondary }]}>유통기한 전에 미리 알려드려요</Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <View style={[styles.stepNumber, { backgroundColor: c.accent }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: c.text }]}>먹어야 할 순서대로</Text>
                  <Text style={[styles.stepDesc, { color: c.textSecondary }]}>가장 급한 재료 3개를 홈에 표시해드려요</Text>
                </View>
              </View>
            </View>

            <Pressable
              style={[styles.emptyHeroCta, { backgroundColor: c.primary }]}
              onPress={() => { Vibration.vibrate(20); router.push('/(tabs)/add'); }}
              accessibilityLabel="첫 식재료 등록하기"
              accessibilityRole="button"
            >
              <Text style={styles.emptyHeroCtaText}>＋ 첫 식재료 등록하기</Text>
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
  // [A1 미니멀 집중형] 스타일
  heroSection: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 13, marginTop: -6, marginBottom: 4 },
  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 18,
    borderRadius: 14, borderLeftWidth: 5,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  heroCardLeft: { flex: 1, overflow: 'hidden', marginRight: 16, gap: 4 },
  heroCardName: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  heroCardMeta: { fontSize: 13 },
  heroCardRight: { alignItems: 'flex-end' },
  heroCardDDay: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  miniStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 20, paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  miniStat: { flex: 1, alignItems: 'center', gap: 4 },
  miniStatCount: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  miniStatLabel: { fontSize: 11, fontWeight: '500' },
  miniStatDivider: { width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.08)' },
  tipCardMinimal: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, gap: 8,
    borderWidth: 1,
  },
  // [Council Round 3 합의 P1-4] statsContainer/statCard/statsRow 미사용 스타일 제거 (A1 미니멀 리팩터링 후)
  quickAddButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 10, gap: 8,
  },
  quickAddIcon: { fontSize: 18, color: '#fff' },
  quickAddText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  section: { marginTop: 10, paddingHorizontal: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  moreLink: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  // [D1 캐릭터 히어로] Empty state
  emptyHero: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 24, gap: 8 },
  emptyCharacter: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCharacterIcon: { fontSize: 56, marginBottom: -10 },
  emptyCharacterFace: { fontSize: 20, fontWeight: '600', color: '#555' },
  emptyHeroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  emptyHeroSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  stepsList: {
    width: '100%', maxWidth: 360, marginTop: 24, gap: 14,
    paddingHorizontal: 4,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  stepDesc: { fontSize: 12, marginTop: 2 },
  emptyHeroCta: {
    marginTop: 28, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6,
  },
  emptyHeroCtaText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8,
    padding: 12, borderRadius: 9, gap: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  tipIcon: { fontSize: 18 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500' },
  locationRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 8, flexWrap: 'wrap' },
  locationChip: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, gap: 6,
    borderWidth: 1,
  },
  locationIcon: { fontSize: 14 },
  locationCount: { fontSize: 13, fontWeight: '700' },
  locationLabel: { fontSize: 12 },
  // [Council Round 3 합의 P1-4] categorySummary 스타일 제거 (미사용)
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
  // 소비 기록 (1~4건 희소 상태)
  outcomeCountRow: { flexDirection: 'row', gap: 16, paddingVertical: 4 },
  outcomeCountItem: { fontSize: 14, fontWeight: '700' },
  outcomeCountHint: { fontSize: 11, marginTop: 6 },
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
