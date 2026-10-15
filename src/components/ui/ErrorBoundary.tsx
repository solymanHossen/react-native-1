import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <AlertTriangle size={32} color="#EF4444" strokeWidth={2.4} />
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 }}>
            Something went wrong
          </Text>

          <Text style={{ fontSize: 14, fontWeight: '400', color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            An unexpected error occurred. Your health records and encrypted vault data remain safe.
          </Text>

          <Pressable
            onPress={this.handleRestart}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#3B82F6',
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 24,
            }}
          >
            <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
              Restart App
            </Text>
          </Pressable>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
