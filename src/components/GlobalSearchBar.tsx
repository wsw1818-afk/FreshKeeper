import React from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, Platform } from 'react-native';
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
        clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
        accessibilityLabel="식재료 검색 입력창"
        accessibilityHint="검색할 식재료 이름을 입력하세요"
      />
      {searchQuery.length > 0 && (
        <Pressable
          onPress={() => setSearchQuery('')}
          style={styles.clear}
          accessibilityLabel="검색어 지우기"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    height: 36,
    flex: 1,
    marginHorizontal: 2,
  },
  icon: { fontSize: 13, marginRight: 5 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  clear: { padding: 2 },
  clearIcon: { fontSize: 13, color: '#999' },
});
