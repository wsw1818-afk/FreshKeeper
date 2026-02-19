import React from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { useFoodStore } from '@/hooks/useFoodStore';
import { useColors } from '@/hooks/useColors';

export default function GlobalSearchBar() {
  const c = useColors();
  const searchQuery = useFoodStore((s) => s.globalSearchQuery);
  const setSearchQuery = useFoodStore((s) => s.setGlobalSearchQuery);

  return (
    <View style={[styles.wrapper, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={styles.icon} accessibilityLabel="검색">🔍</Text>
      <TextInput
        style={[styles.input, { color: c.text }]}
        placeholder="식재료 검색..."
        placeholderTextColor={c.textLight}
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="식재료 검색 입력창"
        accessibilityHint="검색할 식재료 이름을 입력하세요"
      />
      {searchQuery.length > 0 && (
        <Pressable
          onPress={() => setSearchQuery('')}
          style={styles.clear}
          accessibilityLabel="검색어 지우기"
          accessibilityRole="button"
        >
          <Text style={styles.clearIcon}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    flex: 1,
    marginHorizontal: 4,
  },
  icon: { fontSize: 14, marginRight: 6 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clear: { padding: 3 },
  clearIcon: { fontSize: 14, color: '#999' },
});
