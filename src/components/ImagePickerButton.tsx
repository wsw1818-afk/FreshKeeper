import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';

interface ImagePickerButtonProps {
  imageUri: string | null;
  onImageSelected: (uri: string | null) => void;
  size?: 'small' | 'large';
}

export default function ImagePickerButton({
  imageUri,
  onImageSelected,
  size = 'large',
}: ImagePickerButtonProps) {
  const c = useColors();
  const isSmall = size === 'small';

  const pickImage = async (useCamera: boolean) => {
    const permissionFn = useCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permissionFn();
    if (status !== 'granted') {
      Alert.alert('권한 필요', useCamera ? '카메라 권한이 필요합니다.' : '사진 접근 권한이 필요합니다.');
      return;
    }

    const launchFn = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launchFn({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      onImageSelected(result.assets[0].uri);
    }
  };

  const showOptions = () => {
    if (imageUri) {
      Alert.alert('사진', '사진을 변경하거나 삭제할 수 있습니다.', [
        { text: '카메라 촬영', onPress: () => pickImage(true) },
        { text: '갤러리에서 선택', onPress: () => pickImage(false) },
        { text: '사진 삭제', style: 'destructive', onPress: () => onImageSelected(null) },
        { text: '취소', style: 'cancel' },
      ]);
    } else {
      Alert.alert('사진 추가', '식재료 사진을 추가하세요.', [
        { text: '카메라 촬영', onPress: () => pickImage(true) },
        { text: '갤러리에서 선택', onPress: () => pickImage(false) },
        { text: '취소', style: 'cancel' },
      ]);
    }
  };

  const boxSize = isSmall ? 56 : 100;

  return (
    <Pressable
      style={[
        styles.container,
        {
          width: boxSize,
          height: boxSize,
          backgroundColor: c.surface,
          borderColor: c.border,
        },
      ]}
      onPress={showOptions}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: boxSize, height: boxSize, borderRadius: 10 }} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>{isSmall ? '📷' : '📸'}</Text>
          {!isSmall && <Text style={[styles.placeholderText, { color: c.textLight }]}>사진 추가</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    alignItems: 'center',
    gap: 4,
  },
  placeholderIcon: {
    fontSize: 24,
  },
  placeholderText: {
    fontSize: 11,
  },
});
