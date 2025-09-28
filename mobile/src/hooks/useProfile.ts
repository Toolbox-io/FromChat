import { useAppState } from "../state";

/**
 * Hook for profile-related functionality
 */
export function useProfile() {
    const { user } = useAppState();

    return {
        user,
        profileData: user.profileData,
        isLoading: user.isLoading,
        isUpdating: user.isUpdating,
        updateProfileData: user.updateProfileData,
        uploadProfilePictureData: user.uploadProfilePictureData,
    };
}
