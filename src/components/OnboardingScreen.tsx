import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  FlatList, type ViewToken, TextInput, ScrollView,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { insertStorageLocation } from '@/lib/repository';

const { width } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: (selectedFridges?: string[]) => void;
}

const DEFAULT_FRIDGES = [
  { id: 'fridge1', icon: '🧊', name: '주방 냉장고', color: '#2196F3' },
  { id: 'fridge2', icon: '❄️', name: '냉동고', color: '#03A9F4' },
  { id: 'kimchi', icon: '🫙', name: '김치냉장고', color: '#E91E63' },
  { id: 'pantry', icon: '🏠', name: '실온 보관', color: '#FF9800' },
];

const SLIDES = [
  {
    icon: '🧊',
    title: '냉장고 지킴이',
    desc: '식재료의 소비기한을 관리하고\n음식물 쓰레기를 줄여보세요.',
  },
  {
    icon: '⏰',
    title: '스마트 알림',
    desc: '소비기한이 다가오면 미리 알려드립니다.\nD-Day 기반으로 상태를 한눈에 파악하세요.',
  },
  {
    icon: '📊',
    title: '소비 통계',
    desc: '먹음 / 폐기 비율을 분석하고\n더 나은 식재료 관리 습관을 만들어보세요.',
  },
];

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const c = useColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFridgeSetup, setShowFridgeSetup] = useState(false);
  const [selectedFridges, setSelectedFridges] = useState<string[]>(['fridge1']);
  const [customFridgeName, setCustomFridgeName] = useState('');
  const [customFridges, setCustomFridges] = useState<Array<{ id: string; name: string; icon: string; color: string }>>([]);
  const flatListRef = useRef<FlatList>(null);

  // 모든 냉장고 목록 (기본 + 커스텀)
  const allFridges = [...DEFAULT_FRIDGES, ...customFridges];

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      setShowFridgeSetup(true);
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const toggleFridge = (id: string) => {
    setSelectedFridges(prev =>
      prev.includes(id)
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  const handleComplete = async () => {
    onComplete(selectedFridges);
  };

  const handleAddCustomFridge = async () => {
    if (customFridgeName.trim()) {
      try {
        const newLocation = await insertStorageLocation({
          name: customFridgeName.trim(),
          icon: '📦',
          color: '#9C27B0',
          sort_order: 100,
          is_default: false,
          is_system: false,
        });
        // 새로 추가된 냉장고를 커스텀 목록과 선택 목록에 추가
        setCustomFridges(prev => [...prev, { id: newLocation.id, name: newLocation.name, icon: newLocation.icon, color: newLocation.color }]);
        setSelectedFridges(prev => [...prev, newLocation.id]);
        setCustomFridgeName('');
      } catch (error) {
        console.error('Failed to add custom fridge:', error);
      }
    }
  };

  // 냉장고 설정 화면
  if (showFridgeSetup) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <ScrollView contentContainerStyle={styles.fridgeSetupContent}>
          <Text style={styles.fridgeIcon}>🧊</Text>
          <Text style={[styles.fridgeTitle, { color: c.text }]}>
            사용 중인 냉장고를 선택하세요
          </Text>
          <Text style={[styles.fridgeDesc, { color: c.textSecondary }]}>
            선택한 냉장고별로 식재료를 관리할 수 있습니다.
          </Text>

          <View style={styles.fridgeList}>
            {allFridges.map((fridge) => (
              <Pressable
                key={fridge.id}
                style={[
                  styles.fridgeItem,
                  { backgroundColor: c.surface },
                  selectedFridges.includes(fridge.id) && styles.fridgeItemSelected,
                ]}
                onPress={() => toggleFridge(fridge.id)}
              >
                <Text style={styles.fridgeItemIcon}>{fridge.icon}</Text>
                <Text style={[styles.fridgeItemName, { color: c.text }]}>
                  {fridge.name}
                </Text>
                {selectedFridges.includes(fridge.id) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>

          <View style={styles.customFridgeSection}>
            <Text style={[styles.customFridgeLabel, { color: c.textSecondary }]}>
              다른 보관 장소가 있나요?
            </Text>
            <View style={styles.customFridgeInputRow}>
              <TextInput
                style={[styles.customFridgeInput, { backgroundColor: c.surface, color: c.text }]}
                placeholder="예: 베란다 냉장고, 와인 냉장고"
                placeholderTextColor={c.textSecondary}
                value={customFridgeName}
                onChangeText={setCustomFridgeName}
              />
              <Pressable
                style={[styles.addButton, { backgroundColor: c.primary }]}
                onPress={handleAddCustomFridge}
              >
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <Pressable
          style={[styles.completeButton, { backgroundColor: c.primary }]}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>
            {selectedFridges.length}개 냉장고로 시작하기
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Pressable style={styles.skipButton} onPress={() => setShowFridgeSetup(true)}>
        <Text style={[styles.skipText, { color: c.textSecondary }]}>걸너뛰기</Text>
      </Pressable>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.slideIcon}>{item.icon}</Text>
            <Text style={[styles.slideTitle, { color: c.text }]}>{item.title}</Text>
            <Text style={[styles.slideDesc, { color: c.textSecondary }]}>{item.desc}</Text>
          </View>
        )}
      />

      {/* 페이지 인디케이터 */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentIndex ? c.primary : c.divider },
            ]}
          />
        ))}
      </View>

      {/* 다음 / 시작 버튼 */}
      <Pressable style={[styles.nextButton, { backgroundColor: c.primary }]} onPress={handleNext}>
        <Text style={styles.nextText}>
          {isLast ? '냉장고 설정하기' : '다음'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipButton: { position: 'absolute', top: 56, right: 20, zIndex: 1, padding: 8 },
  skipText: { fontSize: 15 },
  slide: {
    width, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40,
  },
  slideIcon: { fontSize: 80, marginBottom: 24 },
  slideTitle: { fontSize: 26, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  slideDesc: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nextButton: {
    marginHorizontal: 24, marginBottom: 48, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center',
  },
  nextText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  // 냉장고 설정 화면 스타일
  fridgeSetupContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 20,
  },
  fridgeIcon: { fontSize: 60, marginBottom: 16, textAlign: 'center' },
  fridgeTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  fridgeDesc: { fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  fridgeList: { gap: 12 },
  fridgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fridgeItemSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  fridgeItemIcon: { fontSize: 28, marginRight: 12 },
  fridgeItemName: { flex: 1, fontSize: 16, fontWeight: '600' },
  checkmark: { fontSize: 20, color: '#2196F3', fontWeight: '700' },
  customFridgeSection: { marginTop: 32 },
  customFridgeLabel: { fontSize: 14, marginBottom: 12 },
  customFridgeInputRow: { flexDirection: 'row', gap: 8 },
  customFridgeInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { fontSize: 24, color: '#fff', fontWeight: '700' },
  completeButton: {
    marginHorizontal: 24,
    marginBottom: 48,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  completeButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
