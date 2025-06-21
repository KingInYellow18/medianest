import os
import requests

UPTIME_KUMA_URL = "http://192.168.1.22:3001"
UPTIME_KUMA_API_KEY = "uk1_Gxt4jJD0N_idQAWvDSOx7TMRBvBO0NF2BEeKJDsn"

def test_uptime_kuma_api():
    """
    Tests the connection to the Uptime Kuma API and fetches monitors.
    """
    if not UPTIME_KUMA_URL or not UPTIME_KUMA_API_KEY:
        print("Uptime Kuma credentials are not set.")
        return

    url = f"{UPTIME_KUMA_URL.rstrip('/')}/api/getMonitors"
    headers = {
        "Authorization": f"Bearer {UPTIME_KUMA_API_KEY}"
    }

    try:
        print(f"Attempting to connect to {url}...")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print("Successfully connected to Uptime Kuma API.")
        
        if data.get("success") and "data" in data:
            print(f"Found {len(data['data'])} monitors.")
            for monitor in data["data"]:
                print(f"  - Monitor: {monitor.get('name', 'Unknown')}, Status: {monitor.get('status', 'unknown')}")
        else:
            print("API call was successful, but the response format is unexpected.")
            print("Response:", data)

    except requests.exceptions.RequestException as e:
        print(f"Failed to connect to Uptime Kuma API: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    test_uptime_kuma_api()