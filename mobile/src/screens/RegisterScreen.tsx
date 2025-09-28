import React, { useState } from 'react';
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
import { API_BASE_URL } from '../core/config';
import type { RegisterRequest, LoginResponse, ErrorResponse } from '../core/types';

export default function RegisterScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const setCurrentPage = useAppState(state => state.setCurrentPage);
    const setUser = useAppState(state => state.setUser);

    const handleRegister = async () => {
        if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
            Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Ошибка', 'Пароли не совпадают');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            Alert.alert('Ошибка', 'Имя пользователя должно быть от 3 до 20 символов');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
            return;
        }

        setLoading(true);
        
        try {
            const request: RegisterRequest = {
                username: username.trim(),
                password: password.trim(),
                confirm_password: confirmPassword.trim()
            };

            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });
            
            if (response.ok) {
                const data: LoginResponse = await response.json();
                setUser(data.token, data.user);
                setCurrentPage("chat");
            } else {
                const data: ErrorResponse = await response.json();
                Alert.alert('Ошибка', data.message || "Ошибка регистрации");
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
                    <Text style={styles.title}>Регистрация</Text>
                    <Text style={styles.subtitle}>Создайте новый аккаунт</Text>
                </View>
                
                <View style={styles.form}>
                    <TextInput
                        label="Имя пользователя"
                        value={username}
                        onChangeText={setUsername}
                        mode="outlined"
                        left={<TextInput.Icon icon="account-plus" />}
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

                    <TextInput
                        label="Подтвердите пароль"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        mode="outlined"
                        secureTextEntry
                        left={<TextInput.Icon icon="lock-check" />}
                        right={<TextInput.Icon icon="eye" />}
                        style={styles.input}
                    />

                    <Button
                        mode="contained"
                        onPress={handleRegister}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                    >
                        Зарегистрироваться
                    </Button>
                </View>
                
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Уже есть аккаунт?{' '}
                        <TouchableOpacity onPress={() => setCurrentPage("login")}>
                            <Text style={styles.link}>Войдите</Text>
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