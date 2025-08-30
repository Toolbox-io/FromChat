export function EditMessageDialog() {
    return (
        <mdui-dialog id="edit-message-dialog" close-on-overlay-click close-on-esc>
            <div className="dialog-content">
                <h3>Edit Message</h3>
                <mdui-text-field 
                    id="edit-message-input"
                    label="Edit Message" 
                    variant="outlined" 
                    placeholder="Edit your message..."
                    maxlength={1000}>
                </mdui-text-field>
                <div className="dialog-actions">
                    <mdui-button id="edit-cancel" variant="outlined">Cancel</mdui-button>
                    <mdui-button id="edit-save">Save</mdui-button>
                </div>
            </div>
        </mdui-dialog>
    );
}
