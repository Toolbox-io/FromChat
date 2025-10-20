import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppState } from "@/pages/chat/state";
import type { ProfileDialogData } from "@/pages/chat/state";
import defaultAvatar from "@/images/default-avatar.png";
import { confirm } from "mdui/functions/confirm";
import { updateProfile, uploadProfilePicture, fetchUserProfileById } from "@/core/api/profileApi";
import { RichTextArea } from "@/core/components/RichTextArea";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { OnlineStatus } from "./right/OnlineStatus";

interface SectionProps {
    type: string;
    icon: string;
    label: string;
    error?: string;
    value?: string;
    onChange?: (value: string) => void;
    readOnly: boolean;
    placeholder: string;
    textArea?: boolean;
}

function Section({ type, icon, label, error, value, onChange, readOnly, placeholder, textArea = false }: SectionProps) {
    let valueComponent: ReactNode = null;

    if (onChange) {
        if (textArea) {
            valueComponent = (
                <RichTextArea
                    text={value || ""}
                    onTextChange={onChange}
                    placeholder={placeholder}
                    className="value"
                    rows={1}
                    readOnly={readOnly}
                />
            );
        } else {
            valueComponent = (
                <input
                className="value"
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                readOnly={readOnly} />
            );
        }
    } else {
        valueComponent = (
            <span className="value">{value}</span>
        );
    }

    return (
        <div className={`section ${type} ${error ? 'error' : ''}`}>
            <mdui-icon name={icon} />
            <div className="content-container">
                <label className="label">{label}</label>
                {valueComponent}
                {error && (
                    <div className="error-message">{error}</div>
                )}
            </div>
        </div>
    )
}

export function ProfileDialog() {
    const { chat, user, closeProfileDialog, setUser } = useAppState();
    const [isOpen, setIsOpen] = useState(false);
    const [originalData, setOriginalData] = useState<ProfileDialogData | null>(null);
    const [currentData, setCurrentData] = useState<ProfileDialogData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<{[key: string]: string}>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openClass, setOpenClass] = useState(false);

    // Handle dialog open/close based on state
    useEffect(() => {
        if (chat.profileDialog && !isOpen) {
            // Fetch fresh data when opening dialog
            fetchFreshProfileData(chat.profileDialog);
        } else if (!chat.profileDialog && isOpen) {
            // Start close animation
                setOpenClass(false);

                // Wait for animation to complete before closing
                setTimeout(() => {
                    setIsOpen(false);
            }, 300);
        }
    }, [chat.profileDialog, isOpen]);

    async function fetchFreshProfileData(profileData: ProfileDialogData) {
        if (!user.authToken) return;

        try {
            let freshData = profileData;

            // If it's not the public chat and has a user ID, fetch fresh data
            if (profileData.userId && profileData.username !== "Общий чат") {
                const userProfile = await fetchUserProfileById(user.authToken, profileData.userId);
                if (userProfile) {
                    freshData = {
                        ...userProfile,
                        memberSince: userProfile.created_at,
                        isOwnProfile: profileData.isOwnProfile
                    };
                }
            }

            setOriginalData(freshData);
            setCurrentData(freshData);
            setIsOpen(true);
        } catch (error) {
            console.error("Failed to fetch fresh profile data:", error);
            // Fallback to cached data if fetch fails
            setOriginalData(profileData);
            setCurrentData(profileData);
            setIsOpen(true);
        }
    }

    // Trigger transition after component mounts
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure DOM is ready for transition
            const timer = requestAnimationFrame(() => {
                setOpenClass(true);
            });
            return () => cancelAnimationFrame(timer);
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        if (isOpen) {
            function handleEsc(e: KeyboardEvent) {
                if (e.key === "Escape") {
                    handleClose();
                }
            }

            document.addEventListener("keydown", handleEsc);
            return () => document.removeEventListener("keydown", handleEsc);
        }
    }, [isOpen]);

    // Subscribe to user's online status when dialog opens
    useEffect(() => {
        if (isOpen && currentData?.userId && !currentData.isOwnProfile) {
            // Subscribe to the user's status
            onlineStatusManager.subscribe(currentData.userId);

            // Cleanup function to unsubscribe when dialog closes
            return () => {
                if (currentData.userId) {
                    onlineStatusManager.unsubscribe(currentData.userId);
                }
            };
        }
    }, [isOpen, currentData?.userId, currentData?.isOwnProfile]);

    // Validate fields when data changes
    useEffect(() => {
        if (currentData && isOpen) {
            validateFields();
        }
    }, [currentData, isOpen]);

    const hasChanges = useMemo(() => {
        if (!originalData || !currentData) return false;

        // Normalize values for comparison (handle empty strings, undefined, null)
        const normalizeValue = (value: string | undefined | null) => {
            if (value === null || value === undefined) return "";
            return value.trim();
        };

        return (
            normalizeValue(originalData.display_name) !== normalizeValue(currentData.display_name) ||
            normalizeValue(originalData.username) !== normalizeValue(currentData.username) ||
            normalizeValue(originalData.bio) !== normalizeValue(currentData.bio) ||
            originalData.profilePicture !== currentData.profilePicture
        );
    }, [originalData, currentData]);

    async function handleClose() {
        if (hasChanges) {
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

    function triggerCloseAnimation() {
        setOpenClass(false);

        // Wait for animation to complete before closing
        setTimeout(() => {
            closeProfileDialog();
        }, 300); // Match CSS transition duration
    };

    function handleBackdropClick(e: React.MouseEvent) {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    function handleDisplayNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!currentData) return;
        const newValue = e.target.value;
        setCurrentData({ ...currentData, display_name: newValue });
        
        // Validate display name in real-time
        validateDisplayName(newValue);
    };

    function handleUsernameChange(value: string) {
        if (!currentData) return;
        setCurrentData({ ...currentData, username: value });
        
        // Validate username in real-time
        validateUsername(value);
    };

    function handleBioChange(newBio: string) {
        if (!currentData) return;
        setCurrentData({ ...currentData, bio: newBio });
    };

    function handleProfilePictureClick() {
        if (currentData?.isOwnProfile) {
            fileInputRef.current?.click();
        }
    };

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
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

    function validateDisplayName(value: string) {
        let error = "";
        
        if (!value || value.trim().length === 0) {
            error = "Отображаемое имя не может быть пустым";
        } else if (value.length > 64) {
            error = "Отображаемое имя не может быть длиннее 64 символов";
        }
        
        setErrors(prev => ({ ...prev, display_name: error }));
    };

    function validateUsername(value: string) {
        let error = "";
        
        if (!value || value.trim().length === 0) {
            error = "Имя пользователя не может быть пустым";
        } else if (value.length < 3) {
            error = "Имя пользователя должно быть не менее 3 символов";
        } else if (value.length > 20) {
            error = "Имя пользователя не может быть длиннее 20 символов";
        } else if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            error = "Имя пользователя может содержать только английские буквы, цифры, дефисы и подчеркивания";
        }
        
        setErrors(prev => ({ ...prev, username: error }));
    };

    function validateFields() {
        if (currentData) {
            validateDisplayName(currentData.display_name || "");
            validateUsername(currentData.username || "");
        }
        
        return !errors.display_name && !errors.username;
    };

    async function handleSave() {
        if (!currentData || !user.authToken || !originalData) return;

        // Validate fields first
        if (!validateFields()) {
            return;
        }

        setIsSaving(true);
        try {
            // Update profile data
            const updateData: any = {};
            if (originalData.display_name !== currentData.display_name) {
                updateData.display_name = currentData.display_name;
            }
            if (originalData.username !== currentData.username) {
                updateData.username = currentData.username;
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

            // If this is the current user's profile and username was changed, update the current user data
            if (currentData.isOwnProfile && user.currentUser && user.authToken) {
                const updatedUser = {
                    ...user.currentUser,
                    username: currentData.username || user.currentUser.username,
                    display_name: currentData.display_name || user.currentUser.display_name,
                    bio: currentData.bio || user.currentUser.bio,
                    profile_picture: currentData.profilePicture || user.currentUser.profile_picture
                };
                setUser(user.authToken, updatedUser);
            }

            // Close dialog with animation after successful save
            triggerCloseAnimation();
        } catch (error) {
            console.error("Failed to save profile:", error);
            // Handle API errors
            if (error instanceof Error && error.message.includes("уже занято")) {
                setErrors({ username: "Это имя пользователя уже занято" });
            } else {
                setErrors({ general: "Ошибка при сохранении профиля" });
            }
        } finally {
            setIsSaving(false);
        }
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    const fabVisible = useMemo(() => {
        let hasErrors = false;
        Object.values(errors).forEach(error => {
            if (error) {
                hasErrors = true;
            }
        });

        return hasChanges && currentData?.isOwnProfile && !isSaving && !hasErrors;
    }, [hasChanges, currentData?.isOwnProfile, isSaving, errors]);

    if (!isOpen || !currentData) return null;

    return createPortal(
        <div
            className={`profile-dialog-backdrop ${openClass ? "open" : ""}`}
            onClick={handleBackdropClick}>
            <div className={`profile-dialog ${openClass ? "open" : ""}`}>
                <div className="profile-dialog-content">
                    <div className="profile-picture-section">
                        <img
                            className="profile-picture"
                            src={currentData.profilePicture || defaultAvatar}
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

                    <div className={`username-section ${errors.display_name ? 'error' : ''}`}>
                        <input
                            className="username-input"
                            type="text"
                            value={currentData.display_name}
                            onChange={handleDisplayNameChange}
                            readOnly={!currentData.isOwnProfile}
                            placeholder="Имя"
                        />
                        {errors.display_name && (
                            <div className="error-message">{errors.display_name}</div>
                        )}
                    </div>

                    {(currentData?.userId || currentData?.isOwnProfile) && (
                        <div className="online-status-section">
                            <OnlineStatus userId={currentData.userId || user.currentUser!.id} />
                        </div>
                    )}

                    <div className="profile-sections">
                        <Section
                            type="username"
                            error={errors.username}
                            icon="alternate_email--filled"
                            label="Имя пользователя:"
                            value={currentData.username}
                            onChange={handleUsernameChange}
                            readOnly={!currentData.isOwnProfile}
                            placeholder="username" />

                        {currentData.bio !== undefined && (
                            <Section
                                type="bio"
                                icon="info--filled"
                                label="О себе:"
                                value={currentData.bio}
                                onChange={handleBioChange}
                                readOnly={!currentData.isOwnProfile}
                                placeholder="Нет информации о себе"
                                textArea
                            />
                        )}

                        {currentData.memberSince && (
                            <Section
                                type="member-since"
                                icon="calendar_month--filled"
                                label="Участник с:"
                                value={formatDate(currentData.memberSince)}
                                readOnly={true}
                                placeholder="Участник с:"
                            />
                        )}
                    </div>
                </div>

                {currentData.isOwnProfile && (
                    <mdui-fab
                        icon="check"
                        className={`profile-dialog-fab ${fabVisible ? "visible" : ""}`}
                        onClick={handleSave}
                        disabled={isSaving}
                    />
                )}

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
