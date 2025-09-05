import { useState, useEffect, useRef, type FormEvent } from "react";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import type { TextField } from "mdui/components/text-field";
import type { DialogProps } from "../../../core/types";
import { MaterialDialog } from "../core/Dialog";
import { useProfile } from "../../hooks/useProfile";
import { ImageCropper } from "./ImageCropper";
import { MaterialTextField } from "../core/TextField";

export function ProfileDialog({ isOpen, onOpenChange }: DialogProps) {
    const { profileData, isLoading, isUpdating, updateProfileData, uploadProfilePictureData } = useProfile();
    const [username, setUsername] = useState("");
    const [description, setDescription] = useState("");
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const success = await updateProfileData({
            nickname: username.trim() || undefined,
            description: description.trim() || undefined
        });
        
        if (success) {
            onOpenChange(false);
        }
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
            
            const success = await uploadProfilePictureData(blob);
            if (success) {
                setShowCropper(false);
                setSelectedImage(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
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

    const profilePictureUrl = profileData?.profile_picture || defaultAvatar;

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
                                    target.src = defaultAvatar;
                                }}
                            />
                            <mdui-button-icon 
                                icon="camera_alt--filled" 
                                id="upload-pfp-btn" 
                                className="upload-overlay" 
                                variant="filled"
                                onClick={handleUploadClick}
                                disabled={isUpdating}
                            />
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
                        <div className="dialog-actions">
                            <mdui-button 
                                type="submit" 
                                id="profile-submit"
                                disabled={isLoading || isUpdating}
                            >
                                {isUpdating ? "Сохранение..." : "Сохранить изменения"}
                            </mdui-button>
                            <mdui-button 
                                id="profile-dialog-close" 
                                variant="outlined" 
                                onClick={() => onOpenChange(false)}
                                disabled={isUpdating}
                            >
                                Закрыть
                            </mdui-button>
                        </div>
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
                        <mdui-button-icon icon="close" onClick={handleCropCancel} />
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
