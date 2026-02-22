import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import type { FoodTemplate } from '@/types';
import { useColors } from '@/hooks/useColors';

interface TemplateGridProps {
  templates: FoodTemplate[];
  onSelect: (template: FoodTemplate) => void;
  selectedIds?: Set<string>; // 장보기 모드용
}

export default function TemplateGrid({ templates, onSelect, selectedIds }: TemplateGridProps) {
  const c = useColors();

  const renderItem = ({ item }: { item: FoodTemplate }) => {
    const isSelected = selectedIds?.has(item.id);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.templateItem,
          { backgroundColor: c.surface, borderColor: c.border },
          pressed && [styles.templateItemPressed, { backgroundColor: c.divider }],
          isSelected && { borderColor: c.primary, borderWidth: 2, backgroundColor: c.statusBg.safe },
        ]}
        onPress={() => onSelect(item)}
      >
        <Text style={styles.templateIcon}>{item.icon}</Text>
        <Text style={[styles.templateName, { color: c.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected && <View style={[styles.checkMark, { backgroundColor: c.primary }]}><Text style={styles.checkText}>✓</Text></View>}
      </Pressable>
    );
  };

  return (
    <FlatList
      data={templates}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={4}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16 },
  row: { justifyContent: 'space-between', marginBottom: 10 },
  templateItem: {
    flex: 1, maxWidth: '24%', aspectRatio: 1, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, padding: 6,
  },
  templateItemPressed: { opacity: 0.7 },
  templateIcon: { fontSize: 26, marginBottom: 6 },
  templateName: { fontSize: 11, textAlign: 'center' },
  checkMark: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
