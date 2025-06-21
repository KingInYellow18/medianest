import os
import requests

UPTIME_KUMA_URL = os.environ.get("UPTIME_KUMA_URL")
UPTIME_KUMA_API_KEY = os.environ.get("UPTIME_KUMA_API_KEY")

def get_services_status():
    """
    Fetches the status of monitored services from Uptime Kuma.
    Returns a list of dicts: [{ "name": ..., "status": ... }, ...]
    Raises an Exception if credentials are missing or the API call fails.
    """
    if not UPTIME_KUMA_URL or not UPTIME_KUMA_API_KEY:
        raise Exception("Uptime Kuma credentials are not set in environment variables.")

    # Correct Uptime Kuma API endpoint for monitors
    url = f"{UPTIME_KUMA_URL.rstrip('/')}/api/getMonitors"
    headers = {
        "Authorization": f"Bearer {UPTIME_KUMA_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        # Parse the new Uptime Kuma API response structure
        services = []
        for monitor in data.get("data", []):
            services.append({
                "name": monitor.get("name", "Unknown"),
                "status": monitor.get("status", "unknown")
            })
        return services
    except Exception as e:
        raise Exception(f"Failed to fetch Uptime Kuma status: {str(e)}")