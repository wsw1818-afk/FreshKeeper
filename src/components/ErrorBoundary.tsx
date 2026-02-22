import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import logger from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>문제가 발생했습니다</Text>
          <Text style={styles.desc}>
            앱에서 예상치 못한 오류가 발생했습니다.{'\n'}
            아래 버튼을 눌러 다시 시도해주세요.
          </Text>
          <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorContent}>
            <Text style={styles.errorText}>{this.state.error?.message}</Text>
          </ScrollView>
          <Pressable style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFF',
  },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  desc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 24,
  },
  errorContent: { padding: 12 },
  errorText: { fontSize: 12, color: '#999', fontFamily: 'monospace' },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
