import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useFoodStore } from '@/hooks/useFoodStore';
import { processImageWithOCR } from '@/lib/ocrService';
import { getAIConfig } from '@/lib/aiApiConfig';
import { FoodCategory, StorageLocation, DateType, type FoodItem } from '@/types';
import { getToday } from '@/lib/dateUtils';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/constants/config';

interface OCRScannerProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OCRScanner({ onClose, onSuccess }: OCRScannerProps) {
  const c = useColors();
  const router = useRouter();
  const addItem = useFoodStore((s) => s.addItem);
  const addItemFromTemplate = useFoodStore((s) => s.addItemFromTemplate);
  const templates = useFoodStore((s) => s.templates);

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    foodName: string | null;
    expiryDate: string | null;
    category: string | null;
  } | null>(null);

  // Select image from gallery
  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewImage(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  }, []);

  // Take photo with camera
  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewImage(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  }, []);

  // Process image with OCR (실제 AI API 또는 Mock)
  const processImage = useCallback(async (uri: string) => {
    setIsProcessing(true);
    try {
      const { provider, apiKey } = await getAIConfig();
      const result = await processImageWithOCR(uri, provider, apiKey);
      setOcrResult({
        foodName: result.foodName,
        expiryDate: result.expiryDate,
        category: null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '이미지 처리 중 오류가 발생했습니다.';
      Alert.alert('OCR 오류', msg);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Register item to fridge
  const registerItem = useCallback(async () => {
    if (!ocrResult?.foodName) {
      Alert.alert('오류', '식재료 이름을 확인해주세요.');
      return;
    }

    try {
      // Find matching template
      const matchedTemplate = templates.find(t =>
        ocrResult.foodName?.toLowerCase().includes(t.name.toLowerCase())
      );

      if (matchedTemplate) {
        // Use template with custom expiry date
        const overrides: Partial<FoodItem> = {};
        if (ocrResult.expiryDate) {
          overrides.expires_at = ocrResult.expiryDate;
        }
        await addItemFromTemplate(matchedTemplate, overrides);
      } else {
        // Manual registration with all required fields
        const today = getToday();
        await addItem({
          name: ocrResult.foodName,
          category: (ocrResult.category as FoodCategory) || FoodCategory.OTHERS,
          location: StorageLocation.FRIDGE,
          image_uri: null,
          quantity: 1,
          unit: '개',
          added_at: today,
          date_type: ocrResult.expiryDate ? DateType.USE_BY : DateType.RECOMMENDED,
          expires_at: ocrResult.expiryDate,
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
          memo: null,
          template_id: null,
          is_favorite: false,
        });
      }

      Alert.alert('등록 완료', `${ocrResult.foodName}이(가) 냉장고에 등록되었습니다.`);
      onSuccess?.();
      onClose();
    } catch (error) {
      Alert.alert('오류', '등록에 실패했습니다.');
    }
  }, [ocrResult, templates, addItem, addItemFromTemplate, onSuccess, onClose]);

  // Manual entry fallback
  const handleManualEntry = useCallback(() => {
    onClose();
    router.push('/(tabs)/add');
  }, [router, onClose]);

  return (
    <Modal visible={true} transparent animationType="slide">
      <SafeAreaView style={[styles.safeArea, { backgroundColor: c.surface }]}>
        <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'} />
        <View style={[styles.container, { backgroundColor: c.background }]}>
          <View style={[styles.header, { backgroundColor: c.surface }]}>
            <Text style={[styles.headerTitle, { color: c.text }]}>OCR 스캔</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: c.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {/* Image Selection Buttons */}
            {!previewImage && (
              <View style={styles.buttonContainer}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: c.primary }]}
                  onPress={takePhoto}
                >
                  <Text style={styles.actionButtonText}>📷 카메라로 촬영</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}
                  onPress={pickImage}
                >
                  <Text style={[styles.actionButtonText, { color: c.text }]}>🖼️ 갤러리에서 선택</Text>
                </Pressable>
                <Pressable
                  style={[styles.manualButton, { borderColor: c.border }]}
                  onPress={handleManualEntry}
                >
                  <Text style={[styles.manualButtonText, { color: c.textSecondary }]}>
                    직접 입력하기
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Preview Image */}
            {previewImage && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: previewImage }} style={styles.previewImage} />

                {isProcessing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color={c.primary} />
                    <Text style={[styles.processingText, { color: '#fff' }]}>
                      이미지 분석 중...
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* OCR Results */}
            {ocrResult && !isProcessing && (
              <View style={[styles.resultContainer, { backgroundColor: c.surface }]}>
                <Text style={[styles.resultTitle, { color: c.text }]}>인식 결과</Text>

                <View style={styles.resultItem}>
                  <Text style={[styles.resultLabel, { color: c.textSecondary }]}>식재료 이름</Text>
                  <Text style={[styles.resultValue, { color: c.text }]}>
                    {ocrResult.foodName || '인식 실패'}
                  </Text>
                </View>

                <View style={styles.resultItem}>
                  <Text style={[styles.resultLabel, { color: c.textSecondary }]}>유통기한</Text>
                  <Text style={[styles.resultValue, { color: c.text }]}>
                    {ocrResult.expiryDate || '인식 실패'}
                  </Text>
                </View>

                <View style={styles.resultItem}>
                  <Text style={[styles.resultLabel, { color: c.textSecondary }]}>카테고리</Text>
                  <Text style={[styles.resultValue, { color: c.text }]}>
                    {ocrResult.category || '기타'}
                  </Text>
                </View>

                <View style={styles.resultActions}>
                  <Pressable
                    style={[styles.registerButton, { backgroundColor: c.primary }]}
                    onPress={registerItem}
                  >
                    <Text style={styles.registerButtonText}>냉장고에 등록</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.retakeButton, { borderColor: c.border }]}
                    onPress={() => {
                      setPreviewImage(null);
                      setOcrResult(null);
                    }}
                  >
                    <Text style={[styles.retakeButtonText, { color: c.text }]}>다시 촬영</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20 },
  content: { flex: 1 },
  contentInner: {
    padding: 16,
    paddingBottom: Platform.OS === 'android' ? 48 : 32,
    // 안드로이드에서 하단 네비게이션 바와 겹치지 않도록 추가 패딩
  },
  buttonContainer: { gap: 12 },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  manualButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    borderRadius: 12,
    padding: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  resultItem: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultActions: {
    marginTop: 20,
    gap: 10,
  },
  registerButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  retakeButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  retakeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
