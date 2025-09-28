import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialDialog } from '../core/Dialog';

interface CropperDialogProps {
    isOpen: boolean;
    onOpenChange: (value: boolean) => void;
    onCancel: () => void;
    onSave: () => void;
}

export function CropperDialog({ isOpen, onOpenChange, onCancel, onSave }: CropperDialogProps) {
    return (
        <MaterialDialog 
            open={isOpen} 
            onOpenChange={onOpenChange}
            headline="Обрезать фото профиля"
        >
            <View style={styles.cropperDialogContent}>
                <View style={styles.cropperContainer}>
                    <View style={styles.cropperArea}>
                        <Text style={styles.placeholderText}>Область обрезки изображения</Text>
                    </View>
                </View>
                <View style={styles.cropperActions}>
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                        <Text style={styles.cancelButtonText}>Отмена</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={onSave}>
                        <Text style={styles.saveButtonText}>Сохранить</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </MaterialDialog>
    );
}

const styles = StyleSheet.create({
    cropperDialogContent: {
        padding: 16,
    },
    cropperContainer: {
        marginVertical: 16,
    },
    cropperArea: {
        height: 300,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    placeholderText: {
        color: '#666',
        fontSize: 16,
    },
    cropperActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        paddingTop: 16,
    },
    button: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 4,
        minWidth: 80,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    saveButton: {
        backgroundColor: '#1976d2',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
});
