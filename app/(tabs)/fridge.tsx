
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFoodStore } from '@/hooks/useFoodStore';
import { StorageLocation, STORAGE_LOCATION_LABEL, STORAGE_LOCATION_ICON, FoodCategory, FOOD_CATEGORY_LABEL, FOOD_CATEGORY_EMOJI, StorageLocationItem } from '@/types';
import { useColors } from '@/hooks/useColors';
import { DerivedStatus } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { calculateStatus } from '@/lib/statusCalculator';
import { formatDisplayDate } from '@/lib/dateUtils';
import { updateStorageLocation } from '@/lib/repository';

export default function FridgeScreen() {
  const router = useRouter();
  const c = useColors();
  const items = useFoodStore((s) => s.items);
  const storageLocations = useFoodStore((s) => s.storageLocations);
  const loadStorageLocations = useFoodStore((s) => s.loadStorageLocations);

  // 모달 상태
  const [selectedLocation, setSelectedLocation] = useState<StorageLocationItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 보관 장소별 식재료 그룹화
  const itemsByLocation = useMemo(() => {
    const grouped: Record<string, typeof items> = {};
    for (const location of storageLocations) {
      grouped[location.id] = items
        .filter((item) => item.location === location.id && !item.consumed_at)
        .sort((a, b) => (a.expires_at ?? '9999-12-31').localeCompare(b.expires_at ?? '9999-12-31'));
    }
    return grouped;
  }, [items, storageLocations]);

  // 보관 장소별 통계
  const locationStats = useMemo(() => {
    const stats: Record<string, { total: number; expired: number; danger: number; warn: number }> = {};
    for (const location of storageLocations) {
      const locationItems = itemsByLocation[location.id] ?? [];
      stats[location.id] = {
        total: locationItems.length,
        expired: locationItems.filter(i => calculateStatus(i).status === DerivedStatus.EXPIRED).length,
        danger: locationItems.filter(i => calculateStatus(i).status === DerivedStatus.DANGER).length,
        warn: locationItems.filter(i => calculateStatus(i).status === DerivedStatus.WARN).length,
      };
    }
    return stats;
  }, [itemsByLocation, storageLocations]);

  // 보관 장소별 카테고리 통계
  const locationCategoryStats = useMemo(() => {
    const stats: Record<string, Record<FoodCategory, number>> = {};
    for (const location of storageLocations) {
      const locationItems = itemsByLocation[location.id] ?? [];
      const catStats: Record<FoodCategory, number> = {} as any;
      for (const item of locationItems) {
        catStats[item.category] = (catStats[item.category] ?? 0) + 1;
      }
      stats[location.id] = catStats;
    }
    return stats;
  }, [itemsByLocation, storageLocations]);

  const handleItemPress = (itemId: string) => {
    router.push(`/item/${itemId}`);
  };

  const handleLocationPress = (location: StorageLocationItem) => {
    setSelectedLocation(location);
    setModalVisible(true);
  };

  const handleBulkDiscard = (locationId: string) => {
    const locationItems = itemsByLocation[locationId] ?? [];
    const expiredItems = locationItems.filter(i => calculateStatus(i).status === DerivedStatus.EXPIRED);

    if (expiredItems.length === 0) return;

    Alert.alert(
      '일괄 폐기',
      `${STORAGE_LOCATION_LABEL[locationId as StorageLocation] ?? locationId}의 만료된 식재료 ${expiredItems.length}개를 모두 폐기할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: `${expiredItems.length}개 폐기`,
          style: 'destructive',
          onPress: async () => {
            const consumeItem = useFoodStore.getState().consumeItem;
            for (const item of expiredItems) {
              await consumeItem(item.id, 'DISCARD' as any);
            }
            Alert.alert('완료', `${expiredItems.length}개 식재료가 폐기 처리되었습니다.`);
          },
        },
      ],
    );
  };

  const handleSetDefaultLocation = async (locationId: string) => {
    try {
      await updateStorageLocation(locationId, { is_default: true });
      await loadStorageLocations();
      Alert.alert('완료', '기본 냉장고가 설정되었습니다.');
    } catch (error) {
      Alert.alert('오류', '기본 냉장고 설정에 실패했습니다.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        {/* 냉장고 등록 버튼 */}
        <Pressable
          style={[styles.addFridgeButton, { backgroundColor: c.primary }]}
          onPress={() => router.push('/(tabs)/add-fridge')}
        >
          <Text style={styles.addFridgeButtonText}>+ 새 냉장고 등록</Text>
        </Pressable>

        {storageLocations.map((location) => {
          const locationItems = itemsByLocation[location.id] ?? [];
          const stats = locationStats[location.id] ?? { total: 0, expired: 0, danger: 0, warn: 0 };
          const catStats = locationCategoryStats[location.id] ?? {};

          return (
            <Pressable
              key={location.id}
              style={[styles.locationSection, { backgroundColor: c.surface }]}
              onPress={() => handleLocationPress(location)}
            >
              <View style={styles.locationHeader}>
                <View style={styles.locationTitle}>
                  <Text style={styles.locationIcon}>{location.icon}</Text>
                  <Text style={[styles.locationName, { color: c.text }]}>{location.name}</Text>
                  <Text style={[styles.locationCount, { color: c.textSecondary }]}>
                    {stats.total}개
                  </Text>
                  {location.is_default && (
                    <Text style={[styles.defaultBadge, { backgroundColor: c.primary }]}>기본</Text>
                  )}
                </View>
                {stats.expired > 0 && (
                  <Pressable
                    style={[styles.discardButton, { backgroundColor: c.status.expired }]}
                    onPress={() => handleBulkDiscard(location.id)}
                  >
                    <Text style={styles.discardButtonText}>만료 {stats.expired}개 폐기</Text>
                  </Pressable>
                )}
              </View>

              {/* 통계 카드 */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: c.background }]}>
                  <Text style={[styles.statCount, { color: c.primary }]}>{stats.total}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>전체</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: c.background }]}>
                  <Text style={[styles.statCount, { color: c.status.expired }]}>{stats.expired}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>만료</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: c.background }]}>
                  <Text style={[styles.statCount, { color: c.status.danger }]}>{stats.danger}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>오늘</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: c.background }]}>
                  <Text style={[styles.statCount, { color: c.status.warn }]}>{stats.warn}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>임박</Text>
                </View>
              </View>

              {/* 식재료 목록 */}
              {locationItems.length > 0 ? (
                locationItems.map((item) => {
                  const { status, dDay } = calculateStatus(item);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.itemCard, { backgroundColor: c.background, borderBottomColor: c.border }]}
                      onPress={() => handleItemPress(item.id)}
                    >
                      <Text style={styles.itemEmoji}>
                        {FOOD_CATEGORY_EMOJI[item.category] ?? '🍽️'}
                      </Text>
                      <View style={styles.itemLeft}>
                        <Text style={[styles.itemName, { color: c.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.itemMeta, { color: c.textSecondary }]}>
                          {item.expires_at ? formatDisplayDate(item.expires_at) : '기한 미설정'}
                        </Text>
                      </View>
                      <StatusBadge status={status} dDay={dDay} size="small" />
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                    {location.name}이(가) 비어있어요
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 냉장고 상세 정보 모달 */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            {selectedLocation && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitle}>
                    <Text style={styles.modalIcon}>{selectedLocation.icon}</Text>
                    <Text style={[styles.modalName, { color: c.text }]}>{selectedLocation.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={[styles.modalClose, { color: c.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* 통계 정보 */}
                <View style={styles.modalStats}>
                  <Text style={[styles.modalSectionTitle, { color: c.textSecondary }]}>보관 현황</Text>
                  <View style={styles.modalStatRow}>
                    <View style={[styles.modalStatCard, { backgroundColor: c.background }]}>
                      <Text style={[styles.modalStatCount, { color: c.primary }]}>
                        {locationStats[selectedLocation.id]?.total ?? 0}
                      </Text>
                      <Text style={[styles.modalStatLabel, { color: c.textSecondary }]}>전체</Text>
                    </View>
                    <View style={[styles.modalStatCard, { backgroundColor: c.background }]}>
                      <Text style={[styles.modalStatCount, { color: c.status.expired }]}>
                        {locationStats[selectedLocation.id]?.expired ?? 0}
                      </Text>
                      <Text style={[styles.modalStatLabel, { color: c.textSecondary }]}>만료</Text>
                    </View>
                    <View style={[styles.modalStatCard, { backgroundColor: c.background }]}>
                      <Text style={[styles.modalStatCount, { color: c.status.danger }]}>
                        {locationStats[selectedLocation.id]?.danger ?? 0}
                      </Text>
                      <Text style={[styles.modalStatLabel, { color: c.textSecondary }]}>오늘</Text>
                    </View>
                    <View style={[styles.modalStatCard, { backgroundColor: c.background }]}>
                      <Text style={[styles.modalStatCount, { color: c.status.warn }]}>
                        {locationStats[selectedLocation.id]?.warn ?? 0}
                      </Text>
                      <Text style={[styles.modalStatLabel, { color: c.textSecondary }]}>임박</Text>
                    </View>
                  </View>
                </View>

                {/* 카테고리별 보관 현황 */}
                {Object.keys(locationCategoryStats[selectedLocation.id] ?? {}).length > 0 && (
                  <View style={styles.modalCategoryStats}>
                    <Text style={[styles.modalSectionTitle, { color: c.textSecondary }]}>카테고리별 보관</Text>
                    {Object.entries(locationCategoryStats[selectedLocation.id] ?? {})
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([category, count]) => (
                        <View key={category} style={styles.modalCategoryItem}>
                          <Text style={[styles.modalCategoryLabel, { color: c.text }]}>
                            {FOOD_CATEGORY_LABEL[category as FoodCategory]}
                          </Text>
                          <Text style={[styles.modalCategoryCount, { color: c.primary }]}>{count}개</Text>
                        </View>
                      ))}
                  </View>
                )}

                {/* 작업 버튼 */}
                <View style={styles.modalActions}>
                  {!selectedLocation.is_default && (
                    <Pressable
                      style={[styles.modalButton, { backgroundColor: c.primary }]}
                      onPress={() => {
                        handleSetDefaultLocation(selectedLocation.id);
                        setModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalButtonText}>기본 냉장고로 설정</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: c.background, borderColor: c.border, borderWidth: 1 }]}
                    onPress={() => {
                      setModalVisible(false);
                      router.push('/(tabs)/add');
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: c.text }]}>식재료 추가</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  locationSection: { borderRadius: 12, overflow: 'hidden' },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  locationTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: { fontSize: 20 },
  locationName: { fontSize: 18, fontWeight: '700' },
  locationCount: { fontSize: 14 },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  discardButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discardButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  itemEmoji: {
    fontSize: 22,
    marginRight: 10,
    width: 30,
    textAlign: 'center',
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    fontSize: 32,
  },
  modalName: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 28,
    padding: 8,
  },
  modalStats: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  modalStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalStatCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalStatCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  modalCategoryStats: {
    marginBottom: 20,
  },
  modalCategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalCategoryLabel: {
    fontSize: 15,
  },
  modalCategoryCount: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalActions: {
    gap: 12,
  },
  modalButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addFridgeButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addFridgeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
