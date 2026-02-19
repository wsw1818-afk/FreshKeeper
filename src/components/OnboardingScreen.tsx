import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  FlatList, type ViewToken,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

const { width } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: () => void;
}

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
    desc: '먹음 / 폐기 / 나눔 비율을 분석하고\n더 나은 식재료 관리 습관을 만들어보세요.',
  },
];

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const c = useColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Pressable style={styles.skipButton} onPress={onComplete}>
        <Text style={[styles.skipText, { color: c.textSecondary }]}>건너뛰기</Text>
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
          {isLast ? '시작하기' : '다음'}
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
});
