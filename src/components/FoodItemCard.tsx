import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import type { FoodItem } from '@/types';
import { STORAGE_LOCATION_ICON, STORAGE_LOCATION_LABEL } from '@/types';
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
  const locationIcon = STORAGE_LOCATION_ICON[item.location];
  const locationLabel = STORAGE_LOCATION_LABEL[item.location];
  const c = useColors();

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
      {item.image_uri && (
        <Image source={{ uri: item.image_uri }} style={styles.thumbnail} />
      )}
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
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  leftSection: {
    flex: 1,
    gap: 4,
    overflow: 'hidden',
  },
  rightSection: {
    marginLeft: 12,
    flexShrink: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 13,
  },
  dateText: {
    fontSize: 12,
  },
});
