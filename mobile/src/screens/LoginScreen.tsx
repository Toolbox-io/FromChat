import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useAppState } from '../state';
import { ensureKeysOnLogin } from '../auth/crypto';
import { API_BASE_URL } from '../core/config';
import { initialize, isSupported, subscribe } from '../utils/push-notifications';
import type { LoginRequest, LoginResponse, ErrorResponse } from '../core/types';

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const setCurrentPage = useAppState(state => state.setCurrentPage);
    const setUser = useAppState(state => state.setUser);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
            return;
        }

        setLoading(true);
        
        try {
            const request: LoginRequest = {
                username: username.trim(),
                password: password.trim()
            };

            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });
            
            if (response.ok) {
                const data: LoginResponse = await response.json();
                // Store the JWT token first
                setUser(data.token, data.user);
                
                // Setup keys with the token we just received
                try {
                    await ensureKeysOnLogin(password, data.token);
                } catch (e) {
                    console.error("Key setup failed:", e);
                }

                setCurrentPage("chat");
                
                // Initialize notifications
                try {
                    if (isSupported()) {
                        const initialized = await initialize();
                        if (initialized) {
                            await subscribe(data.token);
                            console.log("Notifications enabled");
                        } else {
                            console.log("Notification permission denied");
                        }
                    } else {
                        console.log("Notifications not supported");
                    }
                } catch (e) {
                    console.error("Notification setup failed:", e);
                }
            } else {
                const data: ErrorResponse = await response.json();
                Alert.alert('Ошибка', data.message || "Неверное имя пользователя или пароль");
            }
        } catch (error) {
            Alert.alert('Ошибка', 'Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Добро пожаловать!</Text>
                    <Text style={styles.subtitle}>Войдите в свой аккаунт</Text>
                </View>
                
                <View style={styles.form}>
                    <TextInput
                        label="Имя пользователя"
                        value={username}
                        onChangeText={setUsername}
                        mode="outlined"
                        left={<TextInput.Icon icon="account" />}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                    />
                    
                    <TextInput
                        label="Пароль"
                        value={password}
                        onChangeText={setPassword}
                        mode="outlined"
                        secureTextEntry
                        left={<TextInput.Icon icon="lock" />}
                        right={<TextInput.Icon icon="eye" />}
                        style={styles.input}
                    />

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        Войти
                    </Button>
                </View>
                
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Ещё нет аккаунта?{' '}
                        <TouchableOpacity onPress={() => setCurrentPage("register")}>
                            <Text style={styles.link}>Зарегистрируйтесь</Text>
                        </TouchableOpacity>
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
    form: {
        marginBottom: 30,
    },
    input: {
        marginBottom: 16,
    },
    button: {
        marginTop: 16,
        paddingVertical: 8,
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        fontSize: 16,
        color: '#666',
    },
    link: {
        color: '#1976d2',
        fontWeight: 'bold',
    },
});