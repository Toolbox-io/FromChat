import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-get-random-values';

import { useAuth } from './src/hooks/useAuth';
import LoginScreen from './src/components/LoginScreen';
import RegisterScreen from './src/components/RegisterScreen';
import ChatScreen from './src/components/ChatScreen';

type Page = 'login' | 'register' | 'chat';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('login');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <ChatScreen />;
  }

  if (currentPage === 'login') {
    return <LoginScreen onNavigateToRegister={() => setCurrentPage('register')} />;
  }

  return <RegisterScreen onNavigateToLogin={() => setCurrentPage('login')} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});