import { StyledDialog } from "@/core/components/StyledDialog";
import { MaterialIcon } from "@/utils/material";

interface SuspensionDialogProps {
    reason: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SuspensionDialog({ reason, open, onOpenChange }: SuspensionDialogProps) {
    return (
        <StyledDialog
            open={open}
            onOpenChange={onOpenChange}>
            <div className="suspension-dialog-content">
                <div className="suspension-icon-section">
                    <MaterialIcon name="block--filled" className="suspension-icon" />
                </div>
                
                <div className="suspension-text">
                    <h2 className="suspension-headline">Аккаунт заблокирован</h2>
                    <p className="suspension-body">
                        Ваш аккаунт был заблокирован за нарушение правил сообщества. 
                        Вы не можете отправлять сообщения или взаимодействовать с другими пользователями.
                    </p>
                    {reason && reason !== "No reason provided" && (
                        <div className="suspension-reason">
                            <strong>Причина блокировки:</strong> 
                            <div className="suspension-reason-text">
                                {reason}
                            </div>
                        </div>
                    )}
                    <p className="suspension-secondary">
                        Если вы считаете, что блокировка была применена по ошибке,
                        <a href="https://t.me/denis0001_dev" target="_blank" rel="noopener noreferrer">обратитесь к администратору</a> для рассмотрения вашего случая.
                    </p>
                </div>
            </div>
        </StyledDialog>
    );
}
