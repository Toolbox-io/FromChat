import type { DialogProps } from "../../../core/types";
import { MaterialDialog } from "../Dialog";

export function UserProfileDialog({ isOpen, onOpenChange }: DialogProps) {
    return (
        <MaterialDialog open={isOpen} onOpenChange={onOpenChange} close-on-overlay-click close-on-esc>
            <div className="content">
                <div className="profile-picture-section">
                    <img className="profile-picture" alt="Profile Picture" />
                </div>
                <div className="profile-info">
                    <div className="username-section">
                        <h4 className="username"></h4>
                        <div className="online-status"></div>
                    </div>
                    <div className="bio-section">
                        <label>Bio:</label>
                        <div className="bio-display"></div>
                    </div>
                    <div className="profile-stats">
                        <div className="stat">
                            <span className="stat-label">Member since:</span>
                            <span className="stat-value member-since"></span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Last seen:</span>
                            <span className="stat-value last-seen"></span>
                        </div>
                    </div>
                    <div className="profile-actions">
                        <mdui-button id="dm-button" variant="filled">
                            <mdui-icon slot="icon" name="chat--filled"></mdui-icon>
                            Send Message
                        </mdui-button>
                    </div>
                </div>
            </div>
        </MaterialDialog>
    );
}
