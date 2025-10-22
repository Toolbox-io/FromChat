import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useAppState } from "@/pages/chat/state";
import type { ProfileDialogData } from "@/pages/chat/state";
import defaultAvatar from "@/images/default-avatar.png";
import { confirm } from "mdui/functions/confirm";
import { prompt } from "mdui/functions/prompt";
import { updateProfile, uploadProfilePicture, fetchUserProfileById } from "@/core/api/profileApi";
import { RichTextArea } from "@/core/components/RichTextArea";
import { StatusBadge } from "@/core/components/StatusBadge";
import { VerifyButton } from "@/core/components/VerifyButton";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { OnlineStatus } from "./right/OnlineStatus";
import { Input } from "@/core/components/Input";
import { StyledDialog } from "@/core/components/StyledDialog";

interface SectionProps {
    type: string;
    icon: string;
    label: string;
    error?: string;
    value?: string;
    onChange?: (value: string) => void;
    readOnly: boolean;
    placeholder?: string;
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
                    readOnly={readOnly} />
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
        valueComponent = <span className="value">{value}</span>
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

    // Handle dialog open/close based on state
    useEffect(() => {
        if (chat.profileDialog && !isOpen) {
            // Fetch fresh data when opening dialog
            fetchFreshProfileData(chat.profileDialog);
        } else if (!chat.profileDialog && isOpen) {
            setIsOpen(false);
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
                        userId: userProfile.id, // Preserve the userId field
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
                closeProfileDialog();
            } catch {
                // User cancelled, do nothing
            }
        } else {
            closeProfileDialog();
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

            // Close dialog after successful save
            closeProfileDialog();
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

    async function handleSuspend() {
        if (!currentData?.userId || !user.authToken) return;

        const isSuspending = !currentData.suspended;

        try {
            if (isSuspending) {
                const reason = await prompt({
                    headline: "Suspend Account",
                    description: "Enter the reason for suspending this account:",
                    confirmText: "Suspend",
                    cancelText: "Cancel"
                });

                if (reason) {
                    const response = await fetch(`/api/user/${currentData.userId}/suspend`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${user.authToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ reason })
                    });

                    if (response.ok) {
                        closeProfileDialog();
                    } else {
                        const error = await response.json();
                        console.error("Failed to suspend user:", error);
                    }
                }
            } else {
                // Unsuspend user
                const response = await fetch(`/api/user/${currentData.userId}/unsuspend`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${user.authToken}`,
                        "Content-Type": "application/json"
                    }
                });

                if (response.ok) {
                    closeProfileDialog();
                } else {
                    const error = await response.json();
                    console.error("Failed to unsuspend user:", error);
                }
            }
        } catch (error) {
            console.error(`Failed to ${isSuspending ? 'suspend' : 'unsuspend'} user:`, error);
        }
    }

    async function handleDelete() {
        if (!currentData?.userId || !user.authToken) return;

        try {
            await confirm({
                headline: "Delete Account",
                description: "This will permanently delete user data but preserve messages and conversations. If the user is online, they will be immediately logged out. This action cannot be undone.",
                confirmText: "Delete",
                cancelText: "Cancel"
            });

            const response = await fetch(`/api/user/${currentData.userId}/delete`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${user.authToken}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                closeProfileDialog();
            } else {
                const error = await response.json();
                console.error("Failed to delete user:", error);
            }
        } catch (error) {
            // User cancelled or error occurred
            console.error("Failed to delete user:", error);
        }
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

    if (!currentData) return null;

    return (
        <StyledDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    handleClose();
                }
            }}
            onBackdropClick={handleClose}
        >
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
                        <div className="username-with-badge">
                            <Input
                                autoresizing={true}
                                className="username-input"
                                type="text"
                                value={currentData.display_name}
                                onChange={handleDisplayNameChange}
                                readOnly={!currentData.isOwnProfile}
                                placeholder="Имя" />
                            <StatusBadge 
                                verified={currentData.verified || false}
                                userId={currentData.userId}
                                size="large" />
                        </div>
                        {errors.display_name && (
                            <div className="error-message">{errors.display_name}</div>
                        )}
                    </div>

                    {(currentData?.userId || currentData?.isOwnProfile) && !currentData.deleted && (
                        <div className="online-status-section">
                            <OnlineStatus userId={currentData.userId || user.currentUser!.id} />
                        </div>
                    )}

                    {/* Admin Actions Section - Hide for deleted users */}
                    {!currentData.isOwnProfile && user.currentUser?.id === 1 && !currentData.deleted && (
                        <div className="admin-actions-section">
                            <h3 className="admin-actions-header">Admin Actions</h3>
                            <div className="admin-buttons">
                                <mdui-button 
                                    variant="filled" 
                                    color="error"
                                    icon={currentData.suspended ? "check_circle--filled" : "block--filled"}
                                    onClick={handleSuspend}
                                >
                                    {currentData.suspended ? "Unsuspend Account" : "Suspend Account"}
                                </mdui-button>
                                <mdui-button 
                                    variant="filled" 
                                    color="error"
                                    icon="delete_forever--filled"
                                    onClick={handleDelete}
                                >
                                    Delete Account
                                </mdui-button>
                                <VerifyButton 
                                    userId={currentData.userId!}
                                    verified={currentData.verified || false}
                                    onVerificationChange={(verified) => {
                                        setCurrentData({ ...currentData, verified });
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Verify button for non-admin owner */}
                    {!currentData.isOwnProfile && currentData.userId && user.currentUser?.id !== 1 && (
                        <div className="verify-section">
                            <VerifyButton 
                                userId={currentData.userId}
                                verified={currentData.verified || false}
                                onVerificationChange={(verified) => {
                                    setCurrentData({ ...currentData, verified });
                                }}
                            />
                        </div>
                    )}

                    {/* Hide profile sections for deleted users */}
                    {!currentData.deleted && (
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
                                    textArea />
                            )}

                            {currentData.memberSince && (
                                <Section
                                    type="member-since"
                                    icon="calendar_month--filled"
                                    label="Участник с:"
                                    value={formatDate(currentData.memberSince)}
                                    readOnly={true} />
                            )}

                            {currentData.verified && (
                                <Section
                                    type="verified"
                                    icon="verified--filled"
                                    label="Верификация:"
                                    value="Этот аккаунт - официальное лицо FromChat."
                                    readOnly={true}
                                />
                            )}
                        </div>
                    )}

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
        </StyledDialog>
    );
}
