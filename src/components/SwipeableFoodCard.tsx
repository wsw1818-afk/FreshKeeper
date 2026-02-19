import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Image, Vibration } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { FoodItem } from '@/types';
import { STORAGE_LOCATION_ICON, STORAGE_LOCATION_LABEL, Outcome } from '@/types';
import { useColors } from '@/hooks/useColors';
import { calculateStatus } from '@/lib/statusCalculator';
import { formatDisplayDate } from '@/lib/dateUtils';
import StatusBadge from './StatusBadge';

interface SwipeableFoodCardProps {
  item: FoodItem;
  onPress?: (item: FoodItem) => void;
  onConsume?: (item: FoodItem, outcome: Outcome) => void;
}

function SwipeableFoodCardInner({ item, onPress, onConsume }: SwipeableFoodCardProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const c = useColors();
  const { status, dDay } = calculateStatus(item);

  const handleSwipeableOpen = useCallback((direction: 'left' | 'right') => {
    // 스와이프 완료 시 짧은 햅틱 피드백
    Vibration.vibrate(30);
  }, []);

  const renderLeftActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.5, 1], extrapolate: 'clamp' });
    const opacity = dragX.interpolate({ inputRange: [0, 40, 80], outputRange: [0.3, 0.7, 1], extrapolate: 'clamp' });
    return (
      <Pressable style={[styles.leftAction, { backgroundColor: c.status.safe }]} onPress={() => { onConsume?.(item, Outcome.EAT); swipeableRef.current?.close(); }}>
        <Animated.Text style={[styles.actionIcon, { transform: [{ scale }], opacity }]}>😋</Animated.Text>
        <Animated.Text style={[styles.actionText, { opacity }]}>먹음</Animated.Text>
      </Pressable>
    );
  };

  const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
    const opacity = dragX.interpolate({ inputRange: [-80, -40, 0], outputRange: [1, 0.7, 0.3], extrapolate: 'clamp' });
    return (
      <View style={styles.rightActions}>
        <Pressable style={styles.shareAction} onPress={() => { onConsume?.(item, Outcome.SHARE); swipeableRef.current?.close(); }}>
          <Animated.Text style={[styles.actionIcon, { transform: [{ scale }], opacity }]}>🤝</Animated.Text>
          <Animated.Text style={[styles.actionText, { opacity }]}>나눔</Animated.Text>
        </Pressable>
        <Pressable style={[styles.discardAction, { backgroundColor: c.status.danger }]} onPress={() => { onConsume?.(item, Outcome.DISCARD); swipeableRef.current?.close(); }}>
          <Animated.Text style={[styles.actionIcon, { transform: [{ scale }], opacity }]}>🗑️</Animated.Text>
          <Animated.Text style={[styles.actionText, { opacity }]}>폐기</Animated.Text>
        </Pressable>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={80}
      rightThreshold={80}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={handleSwipeableOpen}
    >
      <Pressable
        style={({ pressed }) => [styles.card, { backgroundColor: c.surface }, pressed && styles.cardPressed]}
        onPress={() => onPress?.(item)}
        accessibilityLabel={`${item.name}, ${STORAGE_LOCATION_LABEL[item.location]}`}
        accessibilityHint="상세 정보를 보려면 탭하세요. 왼쪽으로 스와이프하면 먹음, 오른쪽으로 스와이프하면 나눔 또는 폐기 처리할 수 있습니다."
      >
        {item.image_uri && (
          <Image source={{ uri: item.image_uri }} style={styles.thumbnail} />
        )}
        <View style={styles.leftSection}>
          <Text style={[styles.name, { color: c.text }]}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: c.textSecondary }]}>
              {STORAGE_LOCATION_ICON[item.location]} {STORAGE_LOCATION_LABEL[item.location]}
            </Text>
            {item.quantity > 1 && (
              <Text style={[styles.metaText, { color: c.textSecondary }]}>{item.quantity}{item.unit}</Text>
            )}
          </View>
          {item.expires_at && (
            <Text style={[styles.dateText, { color: c.textSecondary }]}>{formatDisplayDate(item.expires_at)}까지</Text>
          )}
        </View>
        <View style={styles.rightSection}>
          <StatusBadge status={status} dDay={dDay} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

const SwipeableFoodCard = React.memo(SwipeableFoodCardInner);
export default SwipeableFoodCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 16, marginVertical: 4, borderRadius: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  cardPressed: { opacity: 0.7 },
  thumbnail: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  leftSection: { flex: 1, gap: 4 },
  rightSection: { marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 13 },
  dateText: { fontSize: 12 },
  leftAction: { justifyContent: 'center', alignItems: 'center', width: 80, marginVertical: 4, marginLeft: 16, borderRadius: 12 },
  rightActions: { flexDirection: 'row', marginVertical: 4, marginRight: 16 },
  shareAction: { backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', width: 70, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  discardAction: { justifyContent: 'center', alignItems: 'center', width: 70, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  actionIcon: { fontSize: 24 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },
});
