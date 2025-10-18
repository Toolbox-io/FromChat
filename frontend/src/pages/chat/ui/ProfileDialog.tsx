import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppState } from "@/pages/chat/state";
import type { ProfileDialogData } from "@/pages/chat/state";
import defaultAvatar from "@/images/default-avatar.png";
import { confirm } from "mdui/functions/confirm.js";
import { updateProfile, uploadProfilePicture } from "@/core/api/profileApi";
import "@/pages/chat/css/profile-dialog.scss";

export function ProfileDialog() {
    const { chat, user, closeProfileDialog } = useAppState();
    const [isOpen, setIsOpen] = useState(false);
    const [originalData, setOriginalData] = useState<ProfileDialogData | null>(null);
    const [currentData, setCurrentData] = useState<ProfileDialogData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    // Handle dialog open/close based on state
    useEffect(() => {
        if (chat.profileDialog && !isOpen) {
            setOriginalData(chat.profileDialog);
            setCurrentData(chat.profileDialog);
            setIsOpen(true);
        } else if (!chat.profileDialog && isOpen) {
            // Start close animation
            if (backdropRef.current && dialogRef.current) {
                backdropRef.current.classList.remove('open');
                dialogRef.current.classList.remove('open');
                
                // Wait for animation to complete before closing
                setTimeout(() => {
                    setIsOpen(false);
                }, 300); // Match CSS transition duration
            } else {
                setIsOpen(false);
            }
        }
    }, [chat.profileDialog, isOpen]);

    // Trigger transition after component mounts
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure DOM is ready for transition
            const timer = setTimeout(() => {
                if (backdropRef.current && dialogRef.current) {
                    backdropRef.current.classList.add('open');
                    dialogRef.current.classList.add('open');
                }
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEsc);
            return () => document.removeEventListener("keydown", handleEsc);
        }
    }, [isOpen]);

    const hasChanges = () => {
        if (!originalData || !currentData) return false;
        return (
            originalData.username !== currentData.username ||
            originalData.bio !== currentData.bio ||
            originalData.profilePicture !== currentData.profilePicture
        );
    };

    const handleClose = async () => {
        if (hasChanges()) {
            try {
                await confirm({
                    headline: "Несохраненные изменения",
                    description: "У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?",
                    confirmText: "Закрыть",
                    cancelText: "Отмена"
                });
                triggerCloseAnimation();
            } catch {
                // User cancelled, do nothing
            }
        } else {
            triggerCloseAnimation();
        }
    };

    const triggerCloseAnimation = () => {
        if (backdropRef.current && dialogRef.current) {
            backdropRef.current.classList.remove('open');
            dialogRef.current.classList.remove('open');
            
            // Wait for animation to complete before closing
            setTimeout(() => {
                closeProfileDialog();
            }, 300); // Match CSS transition duration
        } else {
            closeProfileDialog();
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentData) return;
        setCurrentData({ ...currentData, username: e.target.value });
    };

    const handleBioChange = (e: React.FormEvent<HTMLDivElement>) => {
        if (!currentData) return;
        const newBio = e.currentTarget.textContent || "";
        setCurrentData({ ...currentData, bio: newBio });
    };

    const handleProfilePictureClick = () => {
        if (currentData?.isOwnProfile) {
            fileInputRef.current?.click();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith("image/")) {
            // Open cropper dialog here - for now just update the image
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string;
                if (currentData) {
                    setCurrentData({ ...currentData, profilePicture: imageUrl });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!currentData || !user.authToken || !originalData) return;

        setIsSaving(true);
        try {
            // Update profile data
            const updateData: any = {};
            if (originalData.username !== currentData.username) {
                updateData.nickname = currentData.username;
            }
            if (originalData.bio !== currentData.bio) {
                updateData.description = currentData.bio;
            }

            if (Object.keys(updateData).length > 0) {
                await updateProfile(user.authToken, updateData);
            }

            // Update profile picture if changed
            if (originalData.profilePicture !== currentData.profilePicture && currentData.profilePicture) {
                // Convert data URL to blob if needed
                if (currentData.profilePicture.startsWith("data:")) {
                    const response = await fetch(currentData.profilePicture);
                    const blob = await response.blob();
                    await uploadProfilePicture(user.authToken, blob);
                }
            }

            // Update the original data to match current data
            setOriginalData(currentData);
            
            // Close dialog with animation after successful save
            triggerCloseAnimation();
        } catch (error) {
            console.error("Failed to save profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    if (!isOpen || !currentData) return null;

    return createPortal(
        <div 
            ref={backdropRef}
            className="profile-dialog-backdrop"
            onClick={handleBackdropClick}
        >
            <div ref={dialogRef} className="profile-dialog">
                <div className="profile-dialog-content">
                    {/* Profile Picture */}
                    {currentData.profilePicture && (
                        <div className="profile-picture-section">
                            <img 
                                className="profile-picture"
                                src={currentData.profilePicture}
                                alt="Profile Picture"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = defaultAvatar;
                                }}
                            />
                            {currentData.isOwnProfile && (
                                <div 
                                    className="profile-picture-edit-overlay"
                                    onClick={handleProfilePictureClick}
                                >
                                    <mdui-icon name="camera_alt--filled" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="profile-info">
                        {/* Username */}
                        {currentData.username && (
                            <div className="username-section">
                                <input
                                    className="username-input"
                                    type="text"
                                    value={currentData.username}
                                    onChange={handleUsernameChange}
                                    readOnly={!currentData.isOwnProfile}
                                    placeholder="Имя пользователя"
                                />
                            </div>
                        )}

                        {/* Bio */}
                        {currentData.bio !== undefined && (
                            <div className="bio-section">
                                <label className="bio-label">О себе:</label>
                                <div
                                    className="bio-content"
                                    contentEditable={currentData.isOwnProfile}
                                    onInput={handleBioChange}
                                    suppressContentEditableWarning={true}
                                >
                                    {currentData.bio}
                                </div>
                            </div>
                        )}

                        {/* Member Since */}
                        {currentData.memberSince && (
                            <div className="member-since-section">
                                <span className="member-since-label">Участник с:</span>
                                <span className="member-since-value">
                                    {formatDate(currentData.memberSince)}
                                </span>
                            </div>
                        )}

                        {/* Online Status */}
                        {currentData.online !== undefined && (
                            <div className="online-status-section">
                                <span className={`online-indicator ${currentData.online ? "" : "offline"}`} />
                                <span className="status-text">
                                    {currentData.online ? "Онлайн" : "Оффлайн"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save FAB */}
                {currentData.isOwnProfile && hasChanges() && (
                    <mdui-fab
                        icon="check"
                        className={`profile-dialog-fab ${hasChanges() ? "visible" : ""}`}
                        onClick={handleSave}
                        disabled={isSaving}
                    />
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                />
            </div>
        </div>,
        document.getElementById("root")!
    );
}
