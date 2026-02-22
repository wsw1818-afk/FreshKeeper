import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFoodStore } from '@/hooks/useFoodStore';
import type { StorageLocationItem } from '@/types';
import { useColors } from '@/hooks/useColors';

export default function AddFridgeScreen() {
  const router = useRouter();
  const c = useColors();
  const addStorageLocation = useFoodStore((s) => s.addStorageLocation);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('❄️');
  const [color, setColor] = useState('#2E7D32');

  const icons = ['❄️', '🧊', '🏠', '🥬', '🍎', '🥩', '🥦', '🥚', '🥛', '🍺', '🍷', '🍶', '🍜', '🍚'];
  const colors = ['#2E7D32', '#1976D2', '#F57C00', '#C62828', '#7B1FA2', '#0097A7', '#43A047', '#FF9800'];

  const handleAddFridge = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '냉장고 이름을 입력해주세요.');
      return;
    }

    try {
      await addStorageLocation({
        name: name.trim(),
        icon,
        color,
        sort_order: 0,
        is_default: false,
        is_system: false,
      });

      Alert.alert(
        '등록 완료',
        `${icon} ${name}이(가) 등록되었습니다.`,
        [
          { text: '확인', onPress: () => router.back() }
        ]
      );
    } catch (e) {
      Alert.alert('오류', '등록에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>새 냉장고 등록</Text>

        {/* 이름 입력 */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.text }]}>냉장고 이름 *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            placeholder="예: 주방 냉장고, 거실 김치냉장고"
            placeholderTextColor={c.textLight}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* 아이콘 선택 */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.text }]}>아이콘</Text>
          <View style={styles.iconGrid}>
            {icons.map((i) => (
              <Pressable
                key={i}
                style={[
                  styles.iconButton,
                  { backgroundColor: c.surface, borderColor: c.border },
                  icon === i && { borderColor: c.primary, backgroundColor: c.statusBg.safe }
                ]}
                onPress={() => setIcon(i)}
              >
                <Text style={styles.iconText}>{i}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 색상 선택 */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.text }]}>색상</Text>
          <View style={styles.colorGrid}>
            {colors.map((col) => (
              <Pressable
                key={col}
                style={[
                  styles.colorButton,
                  { backgroundColor: col },
                  color === col && styles.colorButtonSelected
                ]}
                onPress={() => setColor(col)}
              >
                {color === col && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </View>

        {/* 등록 버튼 */}
        <Pressable
          style={[styles.submitButton, { backgroundColor: c.primary }]}
          onPress={handleAddFridge}
        >
          <Text style={styles.submitButtonText}>냉장고 등록</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderWidth: 2,
  },
  iconText: {
    fontSize: 28,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  colorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: '#000',
  },
  checkMark: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
