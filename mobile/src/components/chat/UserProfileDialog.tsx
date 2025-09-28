import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { DialogProps } from "../../core/types";
import type { UserProfile } from "../../core/types";
import { MaterialDialog } from "../core/Dialog";
import { formatTime } from "../../utils/utils";

interface UserProfileDialogProps extends DialogProps {
    userProfile: UserProfile | null;
}

export function UserProfileDialog({ isOpen, onOpenChange, userProfile }: UserProfileDialogProps) {
    const content = userProfile ? (
        <div className="content">
            <div className="profile-picture-section">
                <img 
                    className="profile-picture" 
                    alt="Profile Picture" 
                    src={userProfile.profile_picture || "https://via.placeholder.com/40x40/cccccc/ffffff?text=U"}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://via.placeholder.com/40x40/cccccc/ffffff?text=U";
                    }}
                />
            </div>
            <div className="profile-info">
                <div className="username-section">
                    <h4 className="username">{userProfile.username}</h4>
                    <div className={`online-status ${userProfile.online ? "online" : "offline"}`}>
                        {userProfile.online ? (
                            <>
                                <span className="online-indicator"></span> Онлайн
                            </>
                        ) : (
                            <>
                                <span className="offline-indicator"></span> Последний заход {formatTime(userProfile.last_seen)}
                            </>
                        )}
                    </div>
                </div>
                <div className="bio-section">
                    <label>О себе:</label>
                    <div className="bio-display">
                        {userProfile.bio || "No bio available."}
                    </div>
                </div>
                <div className="profile-stats">
                    <div className="stat">
                        <span className="stat-label">Зарегистрирован:</span>
                        <span className="stat-value member-since">{formatTime(userProfile.created_at)}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Last seen:</span>
                        <span className="stat-value last-seen">{formatTime(userProfile.last_seen)}</span>
                    </div>
                </div>
                <View style={styles.profileActions}>
                    <TouchableOpacity style={styles.dmButton}>
                        <Text style={styles.dmButtonText}>💬 Send Message</Text>
                    </TouchableOpacity>
                </View>
            </div>
        </div>
    ) : null

    return (
        <MaterialDialog open={isOpen} onOpenChange={onOpenChange} close-on-overlay-click close-on-esc id="user-profile-dialog">
            {content}
        </MaterialDialog>
    );
}

const styles = StyleSheet.create({
    profileActions: {
        paddingTop: 16,
    },
    dmButton: {
        backgroundColor: '#1976d2',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    dmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
