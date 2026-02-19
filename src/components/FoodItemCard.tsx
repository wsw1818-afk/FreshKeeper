import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import type { FoodItem } from '@/types';
import { STORAGE_LOCATION_ICON, STORAGE_LOCATION_LABEL } from '@/types';
import { Colors } from '@/constants/colors';
import { calculateStatus } from '@/lib/statusCalculator';
import { formatDisplayDate } from '@/lib/dateUtils';
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

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
    >
      {item.image_uri && (
        <Image source={{ uri: item.image_uri }} style={styles.thumbnail} />
      )}
      <View style={styles.leftSection}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {locationIcon} {locationLabel}
          </Text>
          {item.quantity > 1 && (
            <Text style={styles.metaText}>
              {item.quantity}{item.unit}
            </Text>
          )}
        </View>
        {item.expires_at && (
          <Text style={styles.dateText}>
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
    backgroundColor: Colors.surface,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 1,
    shadowColor: Colors.black,
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
  },
  rightSection: {
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
