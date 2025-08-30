import { ChatInterface } from "../components/chat/ChatInterface";
import { ProfileDialog } from "../components/profile/ProfileDialog";
import { CropperDialog } from "../components/profile/CropperDialog";
import { SettingsDialog } from "../components/settings/SettingsDialog";
import { MessageContextMenu } from "../components/chat/MessageContextMenu";
import { EditMessageDialog } from "../components/chat/EditMessageDialog";
import { ReplyMessageDialog } from "../components/chat/ReplyMessageDialog";
import { UserProfileDialog } from "../components/chat/UserProfileDialog";

export default function ChatScreen() {
    return (
        <>
            <ChatInterface />
            
            <CropperDialog />
            <SettingsDialog />
            <MessageContextMenu />
            <EditMessageDialog />
            <ReplyMessageDialog />
            <UserProfileDialog />
        </>
    );
}