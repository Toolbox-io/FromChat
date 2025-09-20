// Service Worker for Push Notifications
self.addEventListener("push", function(event) {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: data.icon || "/logo.png",
            badge: "/logo.png",
            image: data.image,
            tag: data.tag || "message",
            data: data.data,
            actions: [
                {
                    action: "open",
                    title: "Open Chat"
                },
                {
                    action: "close",
                    title: "Close"
                }
            ],
            requireInteraction: true,
            silent: false
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    if (event.action === "open" || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: "window" }).then(function(clientList) {
                // If there's already a window open, focus it
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === self.location.origin && "focus" in client) {
                        return client.focus();
                    }
                }
                // Otherwise, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(self.location.origin);
                }
            })
        );
    }
});

self.addEventListener("notificationclose", function(event) {
    // Handle notification close if needed
});
