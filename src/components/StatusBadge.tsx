import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DerivedStatus, DERIVED_STATUS_LABEL } from '@/types';
import { useColors } from '@/hooks/useColors';
import { formatDDay } from '@/lib/dateUtils';

interface StatusBadgeProps {
  status: DerivedStatus;
  dDay: number | null;
  size?: 'small' | 'medium';
}

const STATUS_ICONS: Record<DerivedStatus, string> = {
  [DerivedStatus.SAFE]: '✅',
  [DerivedStatus.WARN]: '⚠️',
  [DerivedStatus.DANGER]: '🔴',
  [DerivedStatus.EXPIRED]: '⛔',
  [DerivedStatus.LONG_TERM]: '🔵',
  [DerivedStatus.CHECK_NEEDED]: '❓',
};

export default function StatusBadge({ status, dDay, size = 'medium' }: StatusBadgeProps) {
  const c = useColors();
  const statusKey = status.toLowerCase() as keyof typeof c.statusBg;
  const bgColor = c.statusBg[statusKey] ?? c.statusBg.expired;
  const textColor = c.status[statusKey] ?? c.status.expired;
  const icon = STATUS_ICONS[status];
  const isSmall = size === 'small';

  const statusLabel = DERIVED_STATUS_LABEL[status];
  const displayText = dDay !== null ? formatDDay(dDay) : statusLabel;

  return (
    <View
      style={[styles.badge, { backgroundColor: bgColor }, isSmall && styles.badgeSmall]}
      accessibilityLabel={`상태: ${statusLabel}${dDay !== null ? `, ${displayText}` : ''}`}
      accessibilityRole="text"
    >
      <Text style={[styles.icon, isSmall && styles.iconSmall]}>{icon}</Text>
      <Text style={[styles.text, { color: textColor }, isSmall && styles.textSmall]}>
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  icon: { fontSize: 14 },
  iconSmall: { fontSize: 10 },
  text: { fontSize: 13, fontWeight: '700' },
  textSmall: { fontSize: 11 },
});
