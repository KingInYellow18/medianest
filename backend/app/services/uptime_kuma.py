import os
import asyncio
import socketio
from backend.app.utils.logging import get_logger
from backend.app.utils.exceptions import ExternalServiceError

UPTIME_KUMA_URL = os.environ.get("UPTIME_KUMA_URL")
UPTIME_KUMA_PASSWORD = os.environ.get("UPTIME_KUMA_PASSWORD")  # If authentication is required

logger = get_logger("services.uptime_kuma")

class UptimeKumaService:
    def __init__(self):
        self.sio = socketio.AsyncClient()
        self.url = self._normalize_url(UPTIME_KUMA_URL)
        self.monitors = []
        self.connected = False
        self._register_handlers()

    def _normalize_url(self, url):
        if url is None:
            logger.error("UPTIME_KUMA_URL is not set in environment variables")
            raise ExternalServiceError("UPTIME_KUMA_URL is not set in environment variables.")
        if url.startswith("http://"):
            return url.replace("http://", "ws://")
        elif url.startswith("https://"):
            return url.replace("https://", "wss://")
        return url

    def _register_handlers(self):
        @self.sio.event
        async def connect():
            self.connected = True
            logger.info("Connected to Uptime Kuma WebSocket")

        @self.sio.event
        async def disconnect():
            self.connected = False
            logger.info("Disconnected from Uptime Kuma WebSocket")

        @self.sio.on("monitorList")
        async def on_monitor_list(data):
            self.monitors = data
            logger.debug("Received monitor list", monitor_count=len(data))

    async def connect(self):
        if not self.connected:
            try:
                await self.sio.connect(f"{self.url}/socket.io/", transports=["websocket"])
                logger.info("WebSocket connection established", url=self.url)
                # Optionally authenticate if required
                if UPTIME_KUMA_PASSWORD:
                    await self.sio.emit("login", {"username": "admin", "password": UPTIME_KUMA_PASSWORD})
                    logger.info("Sent login event to Uptime Kuma")
            except Exception as e:
                logger.error("Failed to connect to Uptime Kuma WebSocket", error=str(e), exc_info=True)
                raise ExternalServiceError("Failed to connect to Uptime Kuma WebSocket") from e

    async def get_services_status(self):
        try:
            await self.connect()
            # Request monitor list
            await self.sio.emit("getMonitorList")
            # Wait for the monitorList event to populate self.monitors
            for _ in range(10):
                if self.monitors:
                    break
                await asyncio.sleep(0.2)
            if not self.monitors:
                logger.error("Failed to retrieve monitor list from Uptime Kuma")
                raise ExternalServiceError("Failed to retrieve monitor list from Uptime Kuma.")
            # Format output
            services = []
            for monitor in self.monitors:
                services.append({
                    "name": monitor.get("name", "Unknown"),
                    "status": monitor.get("status", "unknown")
                })
            logger.info("Fetched service statuses from Uptime Kuma", service_count=len(services))
            return services
        except ExternalServiceError:
            raise
        except Exception as e:
            logger.error("Unexpected error in get_services_status", error=str(e), exc_info=True)
            raise ExternalServiceError("Unexpected error in get_services_status") from e

# Usage example (for FastAPI endpoint):
# kuma_service = UptimeKumaService()
# statuses = await kuma_service.get_services_status()