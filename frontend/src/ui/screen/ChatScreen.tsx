import { ChatInterface } from "../components/chat/ChatInterface";
import { CropperDialog } from "../components/profile/CropperDialog";
import { MessageContextMenu } from "../components/chat/MessageContextMenu";
import { EditMessageDialog } from "../components/chat/EditMessageDialog";
import { ReplyMessageDialog } from "../components/chat/ReplyMessageDialog";

export default function ChatScreen() {
    return (
        <>
            <ChatInterface />
            <CropperDialog />
            <MessageContextMenu />
            <EditMessageDialog />
            <ReplyMessageDialog />
        </>
    );
}