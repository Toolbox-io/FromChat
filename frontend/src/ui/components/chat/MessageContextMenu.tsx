export function MessageContextMenu() {
    return (
        <div id="message-context-menu" className="context-menu">
            <div className="context-menu-item" data-action="reply">
                <span className="material-symbols">reply</span>
                Reply
            </div>
            <div className="context-menu-item" data-action="edit">
                <span className="material-symbols">edit</span>
                Edit
            </div>
            <div className="context-menu-item" data-action="delete">
                <span className="material-symbols">delete</span>
                Delete
            </div>
        </div>
    );
}
