import os
import asyncio
import socketio

UPTIME_KUMA_URL = os.environ.get("UPTIME_KUMA_URL")
UPTIME_KUMA_PASSWORD = os.environ.get("UPTIME_KUMA_PASSWORD")  # If authentication is required

class UptimeKumaService:
    def __init__(self):
        self.sio = socketio.AsyncClient()
        self.url = self._normalize_url(UPTIME_KUMA_URL)
        self.monitors = []
        self.connected = False
        self._register_handlers()

    def _normalize_url(self, url):
        if url is None:
            raise Exception("UPTIME_KUMA_URL is not set in environment variables.")
        if url.startswith("http://"):
            return url.replace("http://", "ws://")
        elif url.startswith("https://"):
            return url.replace("https://", "wss://")
        return url

    def _register_handlers(self):
        @self.sio.event
        async def connect():
            self.connected = True

        @self.sio.event
        async def disconnect():
            self.connected = False

        @self.sio.on("monitorList")
        async def on_monitor_list(data):
            self.monitors = data

    async def connect(self):
        if not self.connected:
            await self.sio.connect(f"{self.url}/socket.io/", transports=["websocket"])
            # Optionally authenticate if required
            if UPTIME_KUMA_PASSWORD:
                await self.sio.emit("login", {"username": "admin", "password": UPTIME_KUMA_PASSWORD})

    async def get_services_status(self):
        await self.connect()
        # Request monitor list
        await self.sio.emit("getMonitorList")
        # Wait for the monitorList event to populate self.monitors
        for _ in range(10):
            if self.monitors:
                break
            await asyncio.sleep(0.2)
        if not self.monitors:
            raise Exception("Failed to retrieve monitor list from Uptime Kuma.")
        # Format output
        services = []
        for monitor in self.monitors:
            services.append({
                "name": monitor.get("name", "Unknown"),
                "status": monitor.get("status", "unknown")
            })
        return services

# Usage example (for FastAPI endpoint):
# kuma_service = UptimeKumaService()
# statuses = await kuma_service.get_services_status()