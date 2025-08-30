export function ReplyMessageDialog() {
    return (
        <mdui-dialog id="reply-message-dialog" close-on-overlay-click close-on-esc>
            <div className="dialog-content">
                <h3>Reply to Message</h3>
                <div className="reply-preview" id="reply-preview"></div>
                <mdui-text-field 
                    id="reply-message-input"
                    label="Reply" 
                    variant="outlined" 
                    placeholder="Type your reply..."
                    maxlength={1000}>
                </mdui-text-field>
                <div className="dialog-actions">
                    <mdui-button id="reply-cancel" variant="outlined">Cancel</mdui-button>
                    <mdui-button id="reply-send">Send Reply</mdui-button>
                </div>
            </div>
        </mdui-dialog>
    );
}
