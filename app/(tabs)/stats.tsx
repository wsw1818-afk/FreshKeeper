import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { FOOD_CATEGORY_LABEL } from '@/types';
import type { FoodCategory } from '@/types';
import type { ConsumptionHistory } from '@/types';
import {
  getOutcomeStats,
  getCategoryOutcomeStats,
  getMonthlyStats,
  getConsumptionHistory,
  getAvgDDayAtOutcome,
  getTopDiscardedItems,
  getTopConsumedItems,
  getCategoryDiscardRate,
} from '@/lib/repository';
import type { OutcomeStats, CategoryOutcomeStats, MonthlyStats, TopFoodItem } from '@/lib/repository';

const OUTCOME_COLORS = {
  eat: '#4CAF50',
  discard: '#F44336',
  share: '#2196F3',
};

export default function StatsScreen() {
  const c = useColors();
  const [outcomeStats, setOutcomeStats] = useState<OutcomeStats>({ eat: 0, discard: 0, share: 0, total: 0 });
  const [categoryStats, setCategoryStats] = useState<CategoryOutcomeStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [recentHistory, setRecentHistory] = useState<ConsumptionHistory[]>([]);
  const [avgDDay, setAvgDDay] = useState<{ outcome: string; avg_dday: number }[]>([]);
  const [topDiscarded, setTopDiscarded] = useState<TopFoodItem[]>([]);
  const [topConsumed, setTopConsumed] = useState<TopFoodItem[]>([]);
  const [catDiscardRate, setCatDiscardRate] = useState<{ category: string; total: number; discard: number; rate: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [outcome, category, monthly, history, avg, discarded, consumed, catRate] = await Promise.all([
      getOutcomeStats(), getCategoryOutcomeStats(), getMonthlyStats(6), getConsumptionHistory(20), getAvgDDayAtOutcome(),
      getTopDiscardedItems(5), getTopConsumedItems(5), getCategoryDiscardRate(),
    ]);
    setOutcomeStats(outcome);
    setCategoryStats(category);
    setMonthlyStats(monthly);
    setRecentHistory(history);
    setAvgDDay(avg);
    setTopDiscarded(discarded);
    setTopConsumed(consumed);
    setCatDiscardRate(catRate);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const discardRate = outcomeStats.total > 0 ? Math.round((outcomeStats.discard / outcomeStats.total) * 100) : 0;
  const eatRate = outcomeStats.total > 0 ? Math.round((outcomeStats.eat / outcomeStats.total) * 100) : 0;

  // 뱃지 계산
  const badges = useMemo(() => {
    const result: { icon: string; title: string; desc: string; earned: boolean }[] = [
      { icon: '🎯', title: '첫 소비', desc: '식재료 1개 이상 소비', earned: outcomeStats.total >= 1 },
      { icon: '🔟', title: '10개 달성', desc: '누적 소비 10건 달성', earned: outcomeStats.total >= 10 },
      { icon: '💯', title: '100개 달성', desc: '누적 소비 100건 달성', earned: outcomeStats.total >= 100 },
      { icon: '♻️', title: '제로 웨이스트', desc: '폐기율 0% (5건 이상)', earned: outcomeStats.total >= 5 && discardRate === 0 },
      { icon: '🌿', title: '절약왕', desc: '폐기율 10% 이하 (10건 이상)', earned: outcomeStats.total >= 10 && discardRate <= 10 },
      { icon: '🤝', title: '나눔의 달인', desc: '나눔 5건 이상', earned: outcomeStats.share >= 5 },
    ];
    return result;
  }, [outcomeStats, discardRate]);

  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);

  // 로딩 상태
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>통계 불러오는 중...</Text>
      </View>
    );
  }

  if (outcomeStats.total === 0 && recentHistory.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: c.background }]}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={[styles.emptyTitle, { color: c.text }]}>아직 소비 이력이 없습니다</Text>
        <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>식재료를 먹음/폐기/나눔 처리하면{'\n'}통계가 여기에 표시됩니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 종합 요약 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>종합 요약</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.summaryRow}>
            <SummaryItem label="총 소비" value={outcomeStats.total} unit="건" color={c.text} secondaryColor={c.textSecondary} />
            <SummaryItem label="먹음" value={outcomeStats.eat} unit="건" color={OUTCOME_COLORS.eat} secondaryColor={c.textSecondary} />
            <SummaryItem label="폐기" value={outcomeStats.discard} unit="건" color={OUTCOME_COLORS.discard} secondaryColor={c.textSecondary} />
            <SummaryItem label="나눔" value={outcomeStats.share} unit="건" color={OUTCOME_COLORS.share} secondaryColor={c.textSecondary} />
          </View>
        </View>
      </View>

      {/* 소비율 바 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>소비 비율</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.ratioBarBg, { backgroundColor: c.divider }]}>
            {outcomeStats.total > 0 && (
              <>
                {outcomeStats.eat > 0 && <View style={[styles.ratioSegment, { width: `${(outcomeStats.eat / outcomeStats.total) * 100}%`, backgroundColor: OUTCOME_COLORS.eat }]} />}
                {outcomeStats.discard > 0 && <View style={[styles.ratioSegment, { width: `${(outcomeStats.discard / outcomeStats.total) * 100}%`, backgroundColor: OUTCOME_COLORS.discard }]} />}
                {outcomeStats.share > 0 && <View style={[styles.ratioSegment, { width: `${(outcomeStats.share / outcomeStats.total) * 100}%`, backgroundColor: OUTCOME_COLORS.share }]} />}
              </>
            )}
          </View>
          <View style={styles.rateLegend}>
            <LegendItem color={OUTCOME_COLORS.eat} label={`먹음 ${eatRate}%`} textColor={c.textSecondary} />
            <LegendItem color={OUTCOME_COLORS.discard} label={`폐기 ${discardRate}%`} textColor={c.textSecondary} />
            <LegendItem color={OUTCOME_COLORS.share} label={`나눔 ${outcomeStats.total > 0 ? 100 - eatRate - discardRate : 0}%`} textColor={c.textSecondary} />
          </View>
          {discardRate > 20 && (
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>💡 폐기율이 {discardRate}%입니다. 소량 구매나 빠른 소비를 추천합니다.</Text>
            </View>
          )}
          {discardRate <= 10 && outcomeStats.total >= 5 && (
            <View style={[styles.tipBox, { backgroundColor: c.statusBg.safe }]}>
              <Text style={[styles.tipText, { color: c.status.safe }]}>🎉 폐기율 {discardRate}%! 훌륭한 식재료 관리입니다!</Text>
            </View>
          )}
        </View>
      </View>

      {/* 뱃지 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>뱃지</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.badgeGrid}>
            {earnedBadges.map((b) => (
              <View key={b.title} style={[styles.badgeItem, { backgroundColor: c.statusBg.safe }]}>
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <Text style={[styles.badgeTitle, { color: c.text }]}>{b.title}</Text>
                <Text style={[styles.badgeDesc, { color: c.textSecondary }]}>{b.desc}</Text>
              </View>
            ))}
            {lockedBadges.map((b) => (
              <View key={b.title} style={[styles.badgeItem, { backgroundColor: c.divider, opacity: 0.5 }]}>
                <Text style={styles.badgeIcon}>🔒</Text>
                <Text style={[styles.badgeTitle, { color: c.textSecondary }]}>{b.title}</Text>
                <Text style={[styles.badgeDesc, { color: c.textSecondary }]}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 소비 패턴 분석 (DATA-001) */}
      {topDiscarded.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>자주 버리는 식재료 TOP {topDiscarded.length}</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {topDiscarded.map((item, idx) => (
              <View key={item.food_name} style={styles.rankRow}>
                <Text style={[styles.rankNum, { color: idx < 3 ? OUTCOME_COLORS.discard : c.textSecondary }]}>
                  {idx + 1}
                </Text>
                <Text style={[styles.rankName, { color: c.text }]}>{item.food_name}</Text>
                <Text style={[styles.rankCount, { color: OUTCOME_COLORS.discard }]}>{item.count}회</Text>
              </View>
            ))}
            <View style={[styles.tipBox, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.tipText, { color: '#E65100' }]}>
                💡 자주 버리는 식재료는 소량으로 구매하거나 냉동 보관을 추천합니다.
              </Text>
            </View>
          </View>
        </View>
      )}

      {topConsumed.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>자주 소비하는 식재료 TOP {topConsumed.length}</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {topConsumed.map((item, idx) => (
              <View key={item.food_name} style={styles.rankRow}>
                <Text style={[styles.rankNum, { color: idx < 3 ? OUTCOME_COLORS.eat : c.textSecondary }]}>
                  {idx + 1}
                </Text>
                <Text style={[styles.rankName, { color: c.text }]}>{item.food_name}</Text>
                <Text style={[styles.rankCount, { color: OUTCOME_COLORS.eat }]}>{item.count}회</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {catDiscardRate.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>카테고리별 폐기율</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {catDiscardRate.map((cat) => {
              const catLabel = FOOD_CATEGORY_LABEL[cat.category as FoodCategory] ?? cat.category;
              return (
                <View key={cat.category} style={styles.catRateRow}>
                  <Text style={[styles.catRateLabel, { color: c.text }]}>{catLabel}</Text>
                  <View style={styles.catRateBarContainer}>
                    <View style={[styles.catRateBarBg, { backgroundColor: c.divider }]}>
                      <View style={[styles.catRateBarFill, {
                        width: `${cat.rate}%`,
                        backgroundColor: cat.rate > 30 ? OUTCOME_COLORS.discard : cat.rate > 15 ? '#FF9800' : OUTCOME_COLORS.eat,
                      }]} />
                    </View>
                  </View>
                  <Text style={[styles.catRateValue, { color: cat.rate > 30 ? OUTCOME_COLORS.discard : c.textSecondary }]}>
                    {cat.rate}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 평균 D-Day */}
      {avgDDay.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>평균 소비 시점 (D-Day)</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {avgDDay.map((item) => (
              <View key={item.outcome} style={styles.avgRow}>
                <Text style={[styles.avgLabel, { color: c.text }]}>
                  {item.outcome === 'EAT' ? '😋 먹음' : item.outcome === 'DISCARD' ? '🗑️ 폐기' : '🤝 나눔'}
                </Text>
                <Text style={[styles.avgValue, { color: item.avg_dday < 0 ? c.status.danger : c.status.safe }]}>
                  D{item.avg_dday >= 0 ? '-' : '+'}{Math.abs(Math.round(item.avg_dday))}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 월별 추이 */}
      {monthlyStats.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>월별 추이</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {monthlyStats.map((m) => {
              const total = m.eat + m.discard + m.share;
              return (
                <View key={m.month} style={styles.monthRow}>
                  <Text style={[styles.monthLabel, { color: c.textSecondary }]}>{m.month}</Text>
                  <View style={styles.monthBarContainer}>
                    <View style={[styles.miniBarBg, { backgroundColor: c.divider }]}>
                      {total > 0 && (
                        <>
                          {m.eat > 0 && <View style={[styles.miniSegment, { flex: m.eat, backgroundColor: OUTCOME_COLORS.eat }]} />}
                          {m.discard > 0 && <View style={[styles.miniSegment, { flex: m.discard, backgroundColor: OUTCOME_COLORS.discard }]} />}
                          {m.share > 0 && <View style={[styles.miniSegment, { flex: m.share, backgroundColor: OUTCOME_COLORS.share }]} />}
                        </>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.monthTotal, { color: c.textSecondary }]}>{total}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 카테고리별 */}
      {categoryStats.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>카테고리별 소비</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {categoryStats.map((cat) => {
              const catLabel = FOOD_CATEGORY_LABEL[cat.category as FoodCategory] ?? cat.category;
              return (
                <View key={cat.category} style={styles.catRow}>
                  <Text style={[styles.catLabel, { color: c.text }]}>{catLabel}</Text>
                  <View style={styles.catCounts}>
                    <Text style={[styles.catCount, { color: OUTCOME_COLORS.eat }]}>😋{cat.eat}</Text>
                    <Text style={[styles.catCount, { color: OUTCOME_COLORS.discard }]}>🗑️{cat.discard}</Text>
                    <Text style={[styles.catCount, { color: OUTCOME_COLORS.share }]}>🤝{cat.share}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 최근 이력 */}
      {recentHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>최근 소비 이력</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {recentHistory.map((h) => (
              <View key={h.id} style={[styles.historyRow, { borderBottomColor: c.divider }]}>
                <Text style={styles.historyOutcome}>
                  {h.outcome === 'EAT' ? '😋' : h.outcome === 'DISCARD' ? '🗑️' : '🤝'}
                </Text>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyName, { color: c.text }]}>{h.food_name}</Text>
                  <Text style={[styles.historyDate, { color: c.textSecondary }]}>{h.consumed_at}</Text>
                </View>
                <Text style={[styles.historyDDay, { color: h.d_day_at_outcome < 0 ? c.status.danger : c.status.safe }]}>
                  D{h.d_day_at_outcome >= 0 ? '-' : '+'}{Math.abs(h.d_day_at_outcome)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryItem({ label, value, unit, color, secondaryColor }: { label: string; value: number; unit: string; color: string; secondaryColor: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryUnit, { color: secondaryColor }]}>{unit}</Text>
      <Text style={[styles.summaryLabel, { color: secondaryColor }]}>{label}</Text>
    </View>
  );
}

function LegendItem({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  card: { borderRadius: 12, padding: 16, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '800' },
  summaryUnit: { fontSize: 11 },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  ratioBarBg: { height: 20, borderRadius: 10, flexDirection: 'row', overflow: 'hidden' },
  ratioSegment: { height: 20 },
  rateLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
  tipBox: { backgroundColor: '#FFF3E0', borderRadius: 8, padding: 10 },
  tipText: { fontSize: 12, color: '#E65100', textAlign: 'center' },
  avgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avgLabel: { fontSize: 14 },
  avgValue: { fontSize: 16, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthLabel: { fontSize: 12, width: 60 },
  monthBarContainer: { flex: 1 },
  monthTotal: { fontSize: 12, width: 24, textAlign: 'right' },
  miniBarBg: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  miniSegment: { height: 12 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  catLabel: { fontSize: 13, flex: 1 },
  catCounts: { flexDirection: 'row', gap: 10 },
  catCount: { fontSize: 12, fontWeight: '600' },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  historyOutcome: { fontSize: 20, marginRight: 10 },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 14, fontWeight: '600' },
  historyDate: { fontSize: 11, marginTop: 2 },
  historyDDay: { fontSize: 13, fontWeight: '700' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rankNum: { fontSize: 16, fontWeight: '800', width: 28, textAlign: 'center' },
  rankName: { flex: 1, fontSize: 14 },
  rankCount: { fontSize: 13, fontWeight: '600' },
  catRateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  catRateLabel: { fontSize: 13, width: 80 },
  catRateBarContainer: { flex: 1, marginHorizontal: 8 },
  catRateBarBg: { height: 10, borderRadius: 5, overflow: 'hidden' },
  catRateBarFill: { height: 10, borderRadius: 5 },
  catRateValue: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { width: '30%', borderRadius: 10, padding: 10, alignItems: 'center', gap: 4 },
  badgeIcon: { fontSize: 28 },
  badgeTitle: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  badgeDesc: { fontSize: 9, textAlign: 'center' },
});
