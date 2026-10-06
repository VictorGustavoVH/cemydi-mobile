import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error no controlado en la app', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
          <Text
            accessibilityRole="header"
            className="text-center font-sans-semibold text-xl text-primary"
          >
            Algo salió mal
          </Text>
          <Text className="text-center font-sans text-base text-secondary">
            Ocurrió un error inesperado. Intenta de nuevo.
          </Text>
          <AppButton label="Reintentar" onPress={this.handleRetry} />
        </View>
      );
    }

    return this.props.children;
  }
}
