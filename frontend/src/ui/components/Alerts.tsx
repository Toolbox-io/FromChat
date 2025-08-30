export type AlertType = "success" | "danger"

export interface Alert {
    type: AlertType;
    message: string;
}

export function AlertsContainer({ alerts }: { alerts: Alert[]}) {
    return (
        <div>
            {alerts.map(alert => {
                return <div className={`alert alert-${alert.type}`}>{alert.message}</div>
            })}
        </div>
    )
}