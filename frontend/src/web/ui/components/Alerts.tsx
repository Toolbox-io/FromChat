export type AlertType = "success" | "danger"

export interface Alert {
    type: AlertType;
    message: string;
}

export function AlertsContainer({ alerts }: { alerts: Alert[]}) {
    return (
        <div>
            {alerts.slice(-3).map((alert, i) => {
                return <div className={`alert alert-${alert.type}`} key={i}>{alert.message}</div>
            })}
        </div>
    )
}