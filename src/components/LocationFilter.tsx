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
    <View style={styles.scrollWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {LOCATIONS.map((loc) => {
          const isActive = selected === loc;
          const label = loc === 'ALL' ? '전체' : STORAGE_LOCATION_LABEL[loc];
          const icon = loc === 'ALL' ? '🍱' : STORAGE_LOCATION_ICON[loc];
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
              <Text
                style={[styles.chipLabel, { color: c.text }, isActive && { color: '#fff' }]}
              >
                {label}
              </Text>
              {count > 0 && (
                <Text
                  style={[styles.chipCount, { color: isActive ? 'rgba(255,255,255,0.7)' : c.textSecondary }]}
                >
                  {count}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollWrapper: {
    paddingVertical: 6,
  },
  container: {
    paddingLeft: 12,
    paddingRight: 20,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  chipIcon: {
    fontSize: 18,
    lineHeight: 26,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
  },
  chipCount: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
  },
});
