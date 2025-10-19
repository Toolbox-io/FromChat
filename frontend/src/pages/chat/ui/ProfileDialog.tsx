import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAppState } from "@/pages/chat/state";
import type { ProfileDialogData } from "@/pages/chat/state";
import defaultAvatar from "@/images/default-avatar.png";
import { confirm } from "mdui/functions/confirm";
import { updateProfile, uploadProfilePicture, fetchUserProfile } from "@/core/api/profileApi";
import { RichTextArea } from "@/core/components/RichTextArea";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { OnlineStatus } from "./right/OnlineStatus";

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
            // Fetch fresh data when opening dialog
            fetchFreshProfileData(chat.profileDialog);
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

    const fetchFreshProfileData = async (profileData: ProfileDialogData) => {
        if (!user.authToken) return;

        try {
            let freshData = profileData;

            // If it's not the public chat and has a username, fetch fresh data
            if (profileData.username && profileData.username !== "Общий чат" && profileData.userId) {
                const userProfile = await fetchUserProfile(user.authToken, profileData.username);
                if (userProfile) {
                    freshData = {
                        userId: userProfile.id,
                        username: userProfile.username,
                        profilePicture: userProfile.profile_picture,
                        bio: userProfile.bio,
                        memberSince: userProfile.created_at,
                        online: userProfile.online,
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
    };

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

    const hasChanges = useMemo(() => {
        if (!originalData || !currentData) return false;

        // Normalize values for comparison (handle empty strings, undefined, null)
        const normalizeValue = (value: string | undefined | null) => {
            if (value === null || value === undefined) return "";
            return value.trim();
        };

        return (
            normalizeValue(originalData.username) !== normalizeValue(currentData.username) ||
            normalizeValue(originalData.bio) !== normalizeValue(currentData.bio) ||
            originalData.profilePicture !== currentData.profilePicture
        );
    }, [originalData, currentData]);

    const handleClose = async () => {
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

    const handleBioChange = (newBio: string) => {
        if (!currentData) return;
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

                    {/* Online Status */}
                    {currentData?.userId && (
                        <div className="online-status-section">
                            <OnlineStatus userId={currentData.userId} />
                        </div>
                    )}

                    <div className="profile-sections">
                        {/* Bio */}
                        {currentData.bio !== undefined && (
                            <div className="section bio">
                                <mdui-icon name="info--filled" />
                                <div className="content-container">
                                    <label className="label">О себе:</label>
                                    <RichTextArea
                                        text={currentData.bio || ""}
                                        onTextChange={handleBioChange}
                                        placeholder="Нет информации о себе"
                                        className="value"
                                        rows={1}
                                        readOnly={!currentData.isOwnProfile}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Member Since */}
                        {currentData.memberSince && (
                            <div className="section member-since">
                                <mdui-icon name="calendar_month--filled" />
                                <div className="content-container">
                                    <span className="label">Участник с:</span>
                                    <span className="value">
                                        {formatDate(currentData.memberSince)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save FAB */}
                {currentData.isOwnProfile && (
                    <mdui-fab
                        icon="check"
                        className={`profile-dialog-fab ${hasChanges ? "visible" : ""}`}
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
