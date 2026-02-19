import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { StorageLocation, STORAGE_LOCATION_LABEL, STORAGE_LOCATION_ICON } from '@/types';
import { useColors } from '@/hooks/useColors';

interface LocationFilterProps {
  selected: StorageLocation | 'ALL';
  onSelect: (location: StorageLocation | 'ALL') => void;
  counts?: Record<string, number>;
}

const LOCATIONS: (StorageLocation | 'ALL')[] = [
  'ALL',
  StorageLocation.FRIDGE,
  StorageLocation.FREEZER,
  StorageLocation.KIMCHI_FRIDGE,
  StorageLocation.PANTRY,
];

export default function LocationFilter({ selected, onSelect, counts }: LocationFilterProps) {
  const c = useColors();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {LOCATIONS.map((loc) => {
        const isActive = selected === loc;
        const label = loc === 'ALL' ? '전체' : STORAGE_LOCATION_LABEL[loc];
        const icon = loc === 'ALL' ? '📦' : STORAGE_LOCATION_ICON[loc];
        const count = loc === 'ALL'
          ? Object.values(counts ?? {}).reduce((sum, cv) => sum + cv, 0)
          : counts?.[loc] ?? 0;

        return (
          <Pressable
            key={loc}
            style={[
              styles.chip,
              { backgroundColor: c.surface, borderColor: c.border },
              isActive && { backgroundColor: c.primary, borderColor: c.primary },
            ]}
            onPress={() => onSelect(loc)}
            accessibilityLabel={`${label} ${count}개`}
            accessibilityHint={isActive ? '선택됨' : '선택하려면 탭하세요'}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={styles.chipIcon}>{icon}</Text>
            <Text style={[styles.chipText, { color: c.text }, isActive && { color: '#fff' }]}>
              {label}
            </Text>
            {count > 0 && (
              <View style={[styles.countBadge, { backgroundColor: c.divider }, isActive && styles.countBadgeActive]}>
                <Text style={[styles.countText, { color: c.textSecondary }, isActive && { color: '#fff' }]}>
                  {count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 4,
  },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '500' },
  countBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  countText: { fontSize: 11, fontWeight: '700' },
});
