import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import {
    getStorageLocations,
    insertStorageLocation,
    deleteStorageLocation,
} from '@/lib/repository';
import type { StorageLocationItem } from '@/types';

export default function FridgeSettingsScreen() {
    const c = useColors();
    const router = useRouter();
    const [storageLocations, setStorageLocations] = useState<StorageLocationItem[]>([]);
    const [newFridgeName, setNewFridgeName] = useState('');

    useEffect(() => {
        loadFridges();
    }, []);

    const loadFridges = async () => {
        const locations = await getStorageLocations();
        setStorageLocations(locations);
    };

    const handleAddFridge = async () => {
        if (!newFridgeName.trim()) return;
        try {
            await insertStorageLocation({
                name: newFridgeName.trim(),
                icon: '📦',
                color: '#9C27B0',
                sort_order: storageLocations.length + 1,
                is_default: false,
                is_system: false,
            });
            setNewFridgeName('');
            await loadFridges();
            Alert.alert('완료', '새 냉장고가 추가되었습니다.');
        } catch (error) {
            Alert.alert('오류', '냉장고 추가에 실패했습니다.');
        }
    };

    const handleDeleteFridge = async (id: string, name: string) => {
        Alert.alert('냉장고 삭제', `"${name}"을(를) 삭제하시겠습니까?`, [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    const success = await deleteStorageLocation(id);
                    if (success) {
                        await loadFridges();
                        Alert.alert('완료', '냉장고가 삭제되었습니다.');
                    } else {
                        Alert.alert('삭제 불가', '해당 냉장고에 식재료가 있거나 시스템 기본 냉장고는 삭제할 수 없습니다.');
                    }
                },
            },
        ]);
    };

    return (
        <View style={[styles.container, { backgroundColor: c.background }]}>
            {/* 헤더 */}
            <View style={[styles.header, { borderBottomColor: c.divider }]}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[styles.backButton, { color: c.text }]}>← 뒤로</Text>
                </Pressable>
                <Text style={[styles.title, { color: c.text }]}>🧊 냉장고 관리</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* 냉장고 목록 */}
                <View style={styles.list}>
                    {storageLocations.length === 0 ? (
                        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                            등록된 냉장고가 없습니다.
                        </Text>
                    ) : (
                        storageLocations.map((loc) => (
                            <View
                                key={loc.id}
                                style={[styles.item, { borderBottomColor: c.divider, backgroundColor: c.surface }]}
                            >
                                <View style={styles.itemLeft}>
                                    <Text style={styles.icon}>{loc.icon || '📦'}</Text>
                                    <View>
                                        <Text style={[styles.name, { color: c.text }]}>{loc.name}</Text>
                                        <Text style={[styles.type, { color: c.textSecondary }]}>
                                            {loc.is_system ? '시스템' : '사용자 정의'}
                                            {loc.is_default && ' • 기본'}
                                        </Text>
                                    </View>
                                </View>
                                {!loc.is_default && (
                                    <Pressable
                                        style={[styles.deleteButton, { backgroundColor: '#fee2e2' }]}
                                        onPress={() => handleDeleteFridge(loc.id, loc.name)}
                                    >
                                        <Text style={{ color: '#dc2626', fontSize: 12 }}>삭제</Text>
                                    </Pressable>
                                )}
                            </View>
                        ))
                    )}
                </View>

                {/* 새 냉장고 추가 */}
                <View style={styles.addSection}>
                    <Text style={[styles.addTitle, { color: c.text }]}>새 냉장고 추가</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
                            placeholder="냉장고 이름"
                            placeholderTextColor={c.textLight}
                            value={newFridgeName}
                            onChangeText={setNewFridgeName}
                        />
                        <Pressable
                            style={[styles.addButton, { backgroundColor: newFridgeName.trim() ? c.primary : c.border }]}
                            onPress={handleAddFridge}
                            disabled={!newFridgeName.trim()}
                        >
                            <Text style={styles.addButtonText}>추가</Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: { fontSize: 16 },
    title: { fontSize: 18, fontWeight: '700' },
    content: { flex: 1, padding: 16 },
    list: { gap: 8 },
    emptyText: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
        borderBottomWidth: 1,
    },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { fontSize: 24 },
    name: { fontSize: 15, fontWeight: '600' },
    type: { fontSize: 12, marginTop: 2 },
    deleteButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    addSection: { marginTop: 24 },
    addTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
    inputRow: { flexDirection: 'row', gap: 8 },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    addButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        justifyContent: 'center',
    },
    addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
