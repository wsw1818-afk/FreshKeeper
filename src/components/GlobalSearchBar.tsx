import React from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useFoodStore } from '@/hooks/useFoodStore';
import { useColors } from '@/hooks/useColors';
import logger from '@/lib/logger';

export default function GlobalSearchBar() {
  const c = useColors();
  const searchQuery = useFoodStore((s) => s.globalSearchQuery);
  const setSearchQuery = useFoodStore((s) => s.setGlobalSearchQuery);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim()) {
      logger.info(`🔍 Searching for: "${text}"`);
    }
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={styles.icon} accessibilityLabel="검색">🔍</Text>
      <TextInput
        style={[styles.input, { color: c.text }]}
        placeholder="식재료 검색..."
        placeholderTextColor={c.textLight}
        value={searchQuery}
        onChangeText={handleSearchChange}
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
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.clearButton, { backgroundColor: c.border }]}>
            <Text style={styles.clearIcon}>✕</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  icon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 16, lineHeight: 22, paddingVertical: 4, fontWeight: '400' },
  clear: { padding: 6, marginLeft: 6 },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIcon: { fontSize: 14, color: '#666', fontWeight: '600', paddingVertical: 2 },
});
