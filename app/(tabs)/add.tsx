import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, Alert, KeyboardAvoidingView, Platform,
  SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFoodStore } from '@/hooks/useFoodStore';
import {
  StorageLocation, FoodCategory, DateType,
  STORAGE_LOCATION_LABEL, STORAGE_LOCATION_ICON,
  FOOD_CATEGORY_LABEL,
} from '@/types';
import type { FoodTemplate } from '@/types';
import { useColors } from '@/hooks/useColors';
import { getToday, calculateExpiryDate, isValidDateString, formatDate } from '@/lib/dateUtils';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/constants/config';
import TemplateGrid from '@/components/TemplateGrid';
import ImagePickerButton from '@/components/ImagePickerButton';
import OCRScanner from '@/components/OCRScanner';

type Mode = 'template' | 'grocery' | 'manual';

export default function AddScreen() {
  const router = useRouter();
  const c = useColors();
  const templates = useFoodStore((s) => s.templates);
  const addItemFromTemplate = useFoodStore((s) => s.addItemFromTemplate);
  const addItem = useFoodStore((s) => s.addItem);

  const [mode, setMode] = useState<Mode>('template');
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory | 'ALL'>('ALL');
  const [templateSearch, setTemplateSearch] = useState('');

  // 장보기 모드 상태
  const [groceryCart, setGroceryCart] = useState<Set<string>>(new Set());
  const [isSubmittingGrocery, setIsSubmittingGrocery] = useState(false);

  // 수동 입력 상태
  const [name, setName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [manualCategory, setManualCategory] = useState<FoodCategory>(FoodCategory.OTHERS);
  const [location, setLocation] = useState<string>(StorageLocation.FRIDGE);
  const storageLocations = useFoodStore((s) => s.storageLocations);
  const loadStorageLocations = useFoodStore((s) => s.loadStorageLocations);
  const [expiresAt, setExpiresAt] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('개');
  const [memo, setMemo] = useState('');

  // 컴포넌트 마운트 시 보관 장소 로드
  React.useEffect(() => {
    loadStorageLocations();
  }, []);

  // 인기 템플릿 먼저, 나머지 카테고리/검색 필터
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // 검색어 필터
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.name_en?.toLowerCase().includes(q),
      );
    } else if (categoryFilter === 'ALL') {
      // 검색어 없으면 카테고리 필터 적용
      return result.filter((t) => t.is_popular).length > 0
        ? [...result].sort((a, b) => {
          if (a.is_popular && !b.is_popular) return -1;
          if (!a.is_popular && b.is_popular) return 1;
          return a.sort_order - b.sort_order;
        })
        : result;
    } else {
      result = result.filter((t) => t.category === categoryFilter);
    }

    return result;
  }, [templates, categoryFilter, templateSearch]);

  const handleTemplateSelect = async (template: FoodTemplate) => {
    if (mode === 'grocery') {
      // 장보기 모드: 장바구니 토글
      setGroceryCart((prev) => {
        const next = new Set(prev);
        if (next.has(template.id)) {
          next.delete(template.id);
        } else {
          next.add(template.id);
        }
        return next;
      });
      return;
    }

    try {
      await addItemFromTemplate(template);
      Alert.alert(
        '등록 완료',
        `${template.icon} ${template.name}이(가) 등록되었습니다.`,
        [{ text: '확인' }],
      );
    } catch (e) {
      console.error('등록 오류:', e);
      Alert.alert('오류', `등록에 실패했습니다.\n\n${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleGrocerySubmit = async () => {
    if (groceryCart.size === 0) {
      Alert.alert('알림', '장바구니에 식재료를 추가해주세요.');
      return;
    }
    setIsSubmittingGrocery(true);
    try {
      const selectedTemplates = templates.filter((t) => groceryCart.has(t.id));
      for (const template of selectedTemplates) {
        await addItemFromTemplate(template);
      }
      Alert.alert(
        '일괄 등록 완료',
        `${selectedTemplates.map((t) => t.icon).join('')} ${groceryCart.size}개 식재료가 등록되었습니다.`,
        [{ text: '확인' }],
      );
      setGroceryCart(new Set());
    } catch (e) {
      Alert.alert('오류', '등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingGrocery(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '식재료 이름을 입력해주세요.');
      return;
    }

    const today = getToday();
    let finalExpiresAt: string | null = null;
    if (expiresAt.trim()) {
      if (!isValidDateString(expiresAt)) {
        Alert.alert('알림', '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)');
        return;
      }
      finalExpiresAt = expiresAt;
    }

    try {
      await addItem({
        name: name.trim(),
        category: manualCategory,
        location,
        image_uri: imageUri,
        quantity: parseFloat(quantity) || 1,
        unit: unit || '개',
        added_at: today,
        date_type: finalExpiresAt ? DateType.USE_BY : DateType.RECOMMENDED,
        expires_at: finalExpiresAt,
        opened_at: null,
        thawed_at: null,
        location_changed_at: null,
        freshness_days: null,
        freshness_days_after_open: null,
        is_subdivided: false,
        subdivide_count: null,
        consumed_at: null,
        outcome: null,
        alert_offsets: DEFAULT_NOTIFICATION_SETTINGS.default_alert_offsets,
        alert_enabled: true,
        memo: memo.trim() || null,
        template_id: null,
        is_favorite: false,
      });

      Alert.alert('등록 완료', `${name}이(가) 등록되었습니다.`);
      // 초기화
      setName('');
      setImageUri(null);
      setManualCategory(FoodCategory.OTHERS);
      setExpiresAt('');
      setQuantity('1');
      setUnit('개');
      setMemo('');
    } catch (e) {
      Alert.alert('오류', '등록에 실패했습니다.');
    }
  };

  const categories: (FoodCategory | 'ALL')[] = [
    'ALL',
    FoodCategory.DAIRY,
    FoodCategory.MEAT,
    FoodCategory.POULTRY,
    FoodCategory.SEAFOOD,
    FoodCategory.VEGETABLE,
    FoodCategory.FRUIT,
    FoodCategory.COOKED,
    FoodCategory.SIDE_DISH,
    FoodCategory.FERMENTED,
    FoodCategory.FROZEN_FOOD,
    FoodCategory.SAUCE,
  ];

  const [showOCR, setShowOCR] = useState(false);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: c.background }]}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={c.background}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 모드 전환 */}
        <View style={styles.modeRow}>
          {(['template', 'grocery', 'manual'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              style={[
                styles.modeButton,
                { backgroundColor: c.surface, borderColor: c.border },
                mode === m && { backgroundColor: c.primary, borderColor: c.primary },
              ]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, { color: c.textSecondary }, mode === m && { color: '#fff' }]}>
                {m === 'template' ? '빠른 등록' : m === 'grocery' ? '장보기' : '직접 입력'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* OCR 스캔 버튼 */}
        <Pressable
          style={[styles.ocrButton, { backgroundColor: c.primary }]}
          onPress={() => setShowOCR(true)}
        >
          <Text style={styles.ocrButtonText}>📷 OCR로 유통기한 스캔</Text>
        </Pressable>

        {/* OCR 스캔 모달 */}
        {showOCR && (
          <OCRScanner
            onClose={() => setShowOCR(false)}
            onSuccess={() => {
              // Refresh items after successful registration
            }}
          />
        )}

        {mode === 'template' || mode === 'grocery' ? (
          <View style={styles.templateContainer}>
            {/* 장보기 모드 안내 */}
            {mode === 'grocery' && (
              <View style={styles.groceryBanner}>
                <Text style={styles.groceryBannerText}>
                  🛒 여러 식재료를 선택한 후 한 번에 등록하세요
                </Text>
              </View>
            )}

            {/* 템플릿 검색 */}
            <View style={styles.templateSearchContainer}>
              <TextInput
                style={[styles.templateSearchInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                placeholder="식재료 검색 (한글/영문)..."
                placeholderTextColor={c.textLight}
                value={templateSearch}
                onChangeText={(text) => {
                  setTemplateSearch(text);
                  if (text.trim()) setCategoryFilter('ALL');
                }}
              />
              {templateSearch.length > 0 && (
                <Pressable style={styles.searchClear} onPress={() => setTemplateSearch('')}>
                  <Text style={[styles.searchClearText, { color: c.textSecondary }]}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* 카테고리 필터 */}
            <View style={styles.categoryRowOuter}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                style={styles.categoryRowScroll}
                contentContainerStyle={styles.categoryRowContent}
                decelerationRate="fast"
              >
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.catChip,
                      { backgroundColor: c.surface, borderColor: c.border },
                      categoryFilter === cat && { backgroundColor: c.primary, borderColor: c.primary },
                    ]}
                    onPress={() => setCategoryFilter(cat)}
                  >
                    <Text style={[styles.catChipText, { color: c.textSecondary }, categoryFilter === cat && { color: '#fff', fontWeight: '600' }]}>
                      {cat === 'ALL' ? '인기' : FOOD_CATEGORY_LABEL[cat]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* 템플릿 그리드 */}
            <TemplateGrid
              templates={filteredTemplates}
              onSelect={handleTemplateSelect}
              selectedIds={mode === 'grocery' ? groceryCart : undefined}
            />

            {/* 장보기 모드: 일괄 등록 버튼 */}
            {mode === 'grocery' && groceryCart.size > 0 && (
              <View style={[styles.groceryFooter, { borderTopColor: c.border, backgroundColor: c.background }]}>
                <Pressable
                  style={[styles.grocerySubmitButton, { backgroundColor: c.primary }, isSubmittingGrocery && styles.grocerySubmitDisabled]}
                  onPress={handleGrocerySubmit}
                  disabled={isSubmittingGrocery}
                >
                  <Text style={styles.grocerySubmitText}>
                    {isSubmittingGrocery ? '등록 중...' : `${groceryCart.size}개 일괄 등록`}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <ScrollView style={styles.manualContainer} contentContainerStyle={styles.manualContent}>
            <View style={styles.nameImageRow}>
              <View style={styles.nameField}>
                <Text style={[styles.label, { color: c.text }]}>식재료 이름 *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  placeholder="예: 삼겹살, 딸기"
                  placeholderTextColor={c.textLight}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.imageField}>
                <Text style={[styles.label, { color: c.text }]}>사진</Text>
                <ImagePickerButton imageUri={imageUri} onImageSelected={setImageUri} size="small" />
              </View>
            </View>

            <Text style={[styles.label, { color: c.text }]}>카테고리</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.manualCategoryRow}>
              {Object.values(FoodCategory).map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.catChip,
                    { backgroundColor: c.surface, borderColor: c.border },
                    manualCategory === cat && { backgroundColor: c.primary, borderColor: c.primary },
                  ]}
                  onPress={() => setManualCategory(cat)}
                >
                  <Text style={[styles.catText, { color: c.textSecondary }, manualCategory === cat && { color: '#fff', fontWeight: '600' }]}>
                    {FOOD_CATEGORY_LABEL[cat]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: c.text }]}>보관 위치</Text>
            <View style={styles.locationRow}>
              {storageLocations.map((loc) => (
                <Pressable
                  key={loc.id}
                  style={[
                    styles.locChip,
                    { backgroundColor: c.surface, borderColor: c.border },
                    location === loc.id && { borderColor: c.primary, backgroundColor: c.statusBg.safe },
                  ]}
                  onPress={() => setLocation(loc.id)}
                >
                  <Text style={styles.locIcon}>{loc.icon}</Text>
                  <Text style={[styles.locText, { color: c.textSecondary }, location === loc.id && { color: c.primary, fontWeight: '600' }]}>
                    {loc.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: c.text }]}>소비기한 (선택)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textLight}
              value={expiresAt}
              onChangeText={setExpiresAt}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.quickDateRow}>
              {[
                { label: '오늘', days: 0 },
                { label: '+3일', days: 3 },
                { label: '+1주', days: 7 },
                { label: '+2주', days: 14 },
                { label: '+1달', days: 30 },
              ].map((opt) => (
                <Pressable
                  key={opt.label}
                  style={[styles.quickDateChip, { backgroundColor: c.surface, borderColor: c.border }]}
                  onPress={() => setExpiresAt(calculateExpiryDate(getToday(), opt.days))}
                >
                  <Text style={[styles.quickDateText, { color: c.primary }]}>{opt.label}</Text>
                </Pressable>
              ))}
              {expiresAt ? (
                <Pressable
                  style={[styles.quickDateChip, { backgroundColor: c.surface, borderColor: c.error }]}
                  onPress={() => setExpiresAt('')}
                >
                  <Text style={[styles.quickDateText, { color: c.error }]}>초기화</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.quantityRow}>
              <View style={styles.quantityField}>
                <Text style={[styles.label, { color: c.text }]}>수량</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.unitField}>
                <Text style={[styles.label, { color: c.text }]}>단위</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                  value={unit}
                  onChangeText={setUnit}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: c.text }]}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.memoInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              placeholder="메모를 입력하세요"
              placeholderTextColor={c.textLight}
              value={memo}
              onChangeText={setMemo}
              multiline
            />

            <Pressable style={[styles.submitButton, { backgroundColor: c.primary }]} onPress={handleManualSubmit}>
              <Text style={styles.submitText}>등록하기</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  container: { flex: 1 },
  modeRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2, paddingTop: 2, gap: 6 },
  modeButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', borderWidth: 1 },
  modeText: { fontSize: 13, fontWeight: '600' },
  templateContainer: { flex: 1, paddingTop: 2 },
  templateSearchContainer: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 2, position: 'relative' },
  templateSearchInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, paddingRight: 40, minHeight: 48 },
  searchClear: { position: 'absolute', right: 20, top: 4, bottom: 4, justifyContent: 'center', paddingHorizontal: 10 },
  searchClearText: { fontSize: 18, fontWeight: '600' },
  categoryRowOuter: { marginTop: 0, paddingTop: 0, paddingBottom: 8 },
  categoryRowScroll: {},
  categoryRowContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  catChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  catChipText: { fontSize: 14 },
  catText: { fontSize: 11 },
  manualCategoryRow: { gap: 5, paddingBottom: 4 },
  manualContainer: { flex: 1 },
  manualContent: { padding: 14, paddingBottom: 8 },
  nameImageRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  nameField: { flex: 1 },
  imageField: { alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 5 },
  input: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, borderWidth: 1 },
  memoInput: { minHeight: 70, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  locChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, gap: 4 },
  locIcon: { fontSize: 15 },
  locText: { fontSize: 12 },
  quantityRow: { flexDirection: 'row', gap: 10 },
  quantityField: { flex: 2 },
  unitField: { flex: 1 },
  quickDateRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 6 },
  quickDateChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
  quickDateText: { fontSize: 11, fontWeight: '600' },
  submitButton: { paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  groceryBanner: { backgroundColor: '#FFF8E1', paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 12, borderRadius: 8 },
  groceryBannerText: { fontSize: 12, color: '#F57F17', textAlign: 'center' },
  groceryFooter: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  grocerySubmitButton: { paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  grocerySubmitDisabled: { opacity: 0.6 },
  grocerySubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ocrButton: {
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  ocrButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
