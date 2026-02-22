import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import type { FoodItem } from '@/types';
import { STORAGE_LOCATION_ICON, STORAGE_LOCATION_LABEL, FOOD_CATEGORY_EMOJI, DerivedStatus } from '@/types';
import { calculateStatus } from '@/lib/statusCalculator';
import { formatDisplayDate } from '@/lib/dateUtils';
import { useColors } from '@/hooks/useColors';
import StatusBadge from './StatusBadge';

interface FoodItemCardProps {
  item: FoodItem;
  onPress?: (item: FoodItem) => void;
  onLongPress?: (item: FoodItem) => void;
}

function FoodItemCardInner({ item, onPress, onLongPress }: FoodItemCardProps) {
  const { status, dDay } = calculateStatus(item);
  const locationIcon = STORAGE_LOCATION_ICON[item.location] ?? '📦';
  const locationLabel = STORAGE_LOCATION_LABEL[item.location] ?? item.location;
  const c = useColors();

  const statusBarColor: Record<DerivedStatus, string> = {
    [DerivedStatus.SAFE]: c.status.safe,
    [DerivedStatus.WARN]: c.status.warn,
    [DerivedStatus.DANGER]: c.status.danger,
    [DerivedStatus.EXPIRED]: c.status.expired,
    [DerivedStatus.LONG_TERM]: c.status.longTerm,
    [DerivedStatus.CHECK_NEEDED]: c.status.checkNeeded,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, shadowColor: c.black },
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
    >
      {/* 왼쪽 상태 컬러바 */}
      <View style={[styles.statusBar, { backgroundColor: statusBarColor[status] }]} />
      {/* 썸네일: 사진 있으면 사진, 없으면 카테고리별 이모지 */}
      <View style={[styles.thumbnail, { backgroundColor: c.border }]}>
        {item.image_uri
          ? <Image source={{ uri: item.image_uri }} style={styles.thumbnailImage} />
          : <Text style={styles.thumbnailEmoji}>{FOOD_CATEGORY_EMOJI[item.category] ?? '🍽️'}</Text>
        }
      </View>
      <View style={styles.leftSection}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: c.textSecondary }]} numberOfLines={1}>
            {locationIcon} {locationLabel}
          </Text>
          {item.quantity > 1 && (
            <Text style={[styles.metaText, { color: c.textSecondary }]}>
              {item.quantity}{item.unit}
            </Text>
          )}
        </View>
        {item.expires_at && (
          <Text style={[styles.dateText, { color: c.textSecondary }]}>
            {formatDisplayDate(item.expires_at)}까지
          </Text>
        )}
      </View>
      <View style={styles.rightSection}>
        <StatusBadge status={status} dDay={dDay} />
        <Text style={[styles.swipeHint, { color: c.textLight }]}>›</Text>
      </View>
    </Pressable>
  );
}

const FoodItemCard = React.memo(FoodItemCardInner);
export default FoodItemCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardPressed: { opacity: 0.7 },
  statusBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 12 },
  thumbnail: { width: 40, height: 40, borderRadius: 8, marginRight: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbnailImage: { width: 40, height: 40 },
  thumbnailEmoji: { fontSize: 20 },
  leftSection: { flex: 1, gap: 4, overflow: 'hidden' },
  rightSection: { marginLeft: 12, flexShrink: 0, alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 12 },
  dateText: { fontSize: 12 },
  swipeHint: { fontSize: 18, opacity: 0.4, marginTop: 2 },
});
