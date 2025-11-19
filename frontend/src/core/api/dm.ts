// Re-export from dmApi.ts which has Signal Protocol support
export {
    decryptDm,
    fetchDMHistory,
    sendDMViaWebSocket,
    sendDmWithFiles,
    editDmEnvelope,
    deleteDmEnvelope,
    fetchDMConversations,
    fetchUsers,
    searchUsers,
    fetchUserPublicKey
} from "./dmApi";

export type { DMConversationResponse } from "./dmApi";

