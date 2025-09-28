import React, { useState, useEffect, useRef, type FormEvent } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { TextField } from "mdui/components/text-field";
import type { DialogProps } from "../../core/types";
import { MaterialDialog } from "../core/Dialog";
import { useProfile } from "../../hooks/useProfile";
import { ImageCropper } from "./ImageCropper";
import { MaterialTextField } from "../core/TextField";

export function ProfileDialog({ isOpen, onOpenChange }: DialogProps) {
    const { profileData, isLoading, isUpdating, updateProfileData, uploadProfilePictureData } = useProfile();

    const [username, setUsername] = useState(profileData?.nickname ?? "");
    const [description, setDescription] = useState(profileData?.description ?? "");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Update form fields when profile data changes
    useEffect(() => {
        if (profileData) {
            setUsername(profileData.nickname || "");
            setDescription(profileData.description || "");
        }
    }, [profileData]);

    const handleSubmit = async () => {
        
        await updateProfileData({
            nickname: username.trim() || undefined,
            description: description.trim() || undefined
        });
        
        onOpenChange(false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setSelectedImage(file);
            setShowCropper(true);
        }
    };

    const handleCropComplete = async (croppedImageData: string) => {
        try {
            // Convert data URL to blob
            const response = await fetch(croppedImageData);
            const blob = await response.blob();
            
            await uploadProfilePictureData(blob as any);
            setShowCropper(false);
            setSelectedImage(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Error processing cropped image:', error);
        }
    };

    const handleCropCancel = () => {
        setShowCropper(false);
        setSelectedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const profilePictureUrl = profileData?.profile_picture || "https://via.placeholder.com/40x40/cccccc/ffffff?text=U";

    return (
        <>
            <MaterialDialog id="profile-dialog" close-on-overlay-click close-on-esc open={isOpen} onOpenChange={onOpenChange}>
                <div className="content">
                    <div className="header-top">
                        <div className="profile-picture-container">
                            <img 
                                id="profile-picture" 
                                src={profilePictureUrl} 
                                alt="Ваше фото"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "https://via.placeholder.com/40x40/cccccc/ffffff?text=U";
                                }}
                            />
                            <TouchableOpacity 
                                style={[styles.uploadOverlay, isUpdating && styles.disabledButton]} 
                                onPress={handleUploadClick}
                                disabled={isUpdating}
                            >
                                <Text style={styles.uploadIcon}>📷</Text>
                            </TouchableOpacity>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                id="pfp-file-input" 
                                accept="image/*" 
                                style={{ display: "none" }}
                                onChange={handleImageSelect}
                            />
                        </div>
                        <MaterialTextField
                            id="username-field" 
                            label="Имя пользователя" 
                            variant="outlined" 
                            value={username}
                            onChange={(e: FormEvent<HTMLElement & TextField>) => setUsername((e.target as TextField).value)}
                            autocomplete="username"
                            disabled={isLoading || isUpdating} />
                    </div>

                    <form id="profile-form" onSubmit={handleSubmit}>
                        <MaterialTextField
                            id="description-field"
                            label="О себе" 
                            variant="outlined" 
                            value={description}
                            onChange={(e: FormEvent<HTMLElement & TextField>) => setDescription((e.target as TextField).value)}
                            placeholder="Расскажите о себе..."
                            autocomplete="none"
                            disabled={isLoading || isUpdating} />
                        <View style={styles.dialogActions}>
                            <TouchableOpacity 
                                style={[styles.button, styles.submitButton, (isLoading || isUpdating) && styles.disabledButton]} 
                                onPress={handleSubmit}
                                disabled={isLoading || isUpdating}
                            >
                                <Text style={styles.submitButtonText}>
                                    {isUpdating ? "Сохранение..." : "Сохранить изменения"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.button, styles.closeButton]} 
                                onPress={() => onOpenChange(false)}
                                disabled={isUpdating}
                            >
                                <Text style={styles.closeButtonText}>Закрыть</Text>
                            </TouchableOpacity>
                        </View>
                    </form>
                </div>
            </MaterialDialog>

            {/* Image Cropper Dialog */}
            <MaterialDialog 
                id="cropper-dialog" 
                close-on-overlay-click 
                close-on-esc 
                open={showCropper} 
                onOpenChange={setShowCropper}
            >
                <div className="cropper-dialog-content">
                    <div className="cropper-header">
                        <h3>Обрезать фото профиля</h3>
                        <TouchableOpacity onPress={handleCropCancel}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </div>
                    <div className="cropper-container">
                        <ImageCropper
                            imageFile={selectedImage}
                            onCrop={handleCropComplete}
                            onCancel={handleCropCancel}
                        />
                    </div>
                </div>
            </MaterialDialog>
        </>
    );
}

const styles = StyleSheet.create({
    uploadOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#1976d2',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadIcon: {
        color: 'white',
        fontSize: 20,
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    dialogActions: {
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
    submitButton: {
        backgroundColor: '#1976d2',
    },
    closeButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    submitButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    closeButtonText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    closeIcon: {
        fontSize: 20,
        color: '#666',
    },
});
