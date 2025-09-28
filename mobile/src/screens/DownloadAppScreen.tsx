import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';

export default function DownloadAppScreen() {
    const handleGitHubPress = () => {
        Linking.openURL('https://github.com/denis0001-dev/FromChat-android/releases/latest');
    };

    const handleSupportPress = () => {
        Linking.openURL('https://t.me/denis0001-dev');
    };

    return (
        <View style={styles.container}>
            <View style={styles.inner}>
                <Text style={styles.title}>Чтобы пользоваться мессенджером, скачайте приложение</Text>
                <Text style={styles.description}>
                    Этот сайт <Text style={styles.bold}>не предназначен</Text> для работы на маленьких экранах, поэтому
                    вам нужно скачать приложение мессенджера.
                </Text>

                <TouchableOpacity style={styles.button} onPress={handleGitHubPress}>
                    <Text style={styles.buttonText}>Скачать на GitHub</Text>
                </TouchableOpacity>
                
                <Text style={styles.description}>
                    Если возникнут сложности или есть вопросы, нажмите кнопку!
                </Text>

                <TouchableOpacity style={styles.button} onPress={handleSupportPress}>
                    <Text style={styles.buttonText}>Написать в поддержку</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    inner: {
        maxWidth: 400,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        color: '#333',
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
        lineHeight: 24,
    },
    bold: {
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#1976d2',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});