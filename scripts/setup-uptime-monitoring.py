#!/usr/bin/env python3
"""
Setup uptime monitoring for MediaNest documentation site.
Integrates with UptimeRobot and other monitoring services.
"""

import os
import sys
import json
import requests
import argparse
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class UptimeMonitoringSetup:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.uptimerobot.com/v2"
        self.monitors = []
    
    def create_monitor(self, url, name, monitor_type=1, interval=300):
        """Create a new uptime monitor."""
        payload = {
            'api_key': self.api_key,
            'format': 'json',
            'type': monitor_type,  # 1 = HTTP(s)
            'url': url,
            'friendly_name': name,
            'interval': interval  # Check interval in seconds
        }
        
        try:
            response = requests.post(f"{self.base_url}/newMonitor", data=payload)
            result = response.json()
            
            if result.get('stat') == 'ok':
                monitor_id = result['monitor']['id']
                logger.info(f"✓ Created monitor '{name}': {monitor_id}")
                return monitor_id
            else:
                logger.error(f"✗ Failed to create monitor '{name}': {result.get('error', {}).get('message', 'Unknown error')}")
                return None
        
        except Exception as e:
            logger.error(f"✗ Error creating monitor '{name}': {e}")
            return None
    
    def get_monitors(self):
        """Get existing monitors."""
        payload = {
            'api_key': self.api_key,
            'format': 'json'
        }
        
        try:
            response = requests.post(f"{self.base_url}/getMonitors", data=payload)
            result = response.json()
            
            if result.get('stat') == 'ok':
                self.monitors = result.get('monitors', [])
                logger.info(f"Found {len(self.monitors)} existing monitors")
                return self.monitors
            else:
                logger.error(f"Failed to get monitors: {result.get('error', {}).get('message', 'Unknown error')}")
                return []
        
        except Exception as e:
            logger.error(f"Error getting monitors: {e}")
            return []
    
    def monitor_exists(self, url):
        """Check if a monitor for the URL already exists."""
        for monitor in self.monitors:
            if monitor.get('url') == url:
                return monitor
        return None
    
    def setup_docs_monitoring(self, base_url="https://docs.medianest.com"):
        """Setup comprehensive monitoring for documentation site."""
        logger.info(f"Setting up monitoring for {base_url}")
        
        # Get existing monitors
        self.get_monitors()
        
        # Define monitoring targets
        monitoring_targets = [
            {
                'url': base_url,
                'name': 'MediaNest Docs - Home',
                'interval': 300  # 5 minutes
            },
            {
                'url': f"{base_url}/getting-started/",
                'name': 'MediaNest Docs - Getting Started',
                'interval': 600  # 10 minutes
            },
            {
                'url': f"{base_url}/api/",
                'name': 'MediaNest Docs - API Reference',
                'interval': 600  # 10 minutes
            },
            {
                'url': f"{base_url}/search/",
                'name': 'MediaNest Docs - Search',
                'interval': 900  # 15 minutes
            }
        ]
        
        created_monitors = []
        
        for target in monitoring_targets:
            existing_monitor = self.monitor_exists(target['url'])
            
            if existing_monitor:
                logger.info(f"Monitor for {target['url']} already exists: {existing_monitor['friendly_name']}")
                created_monitors.append({
                    'id': existing_monitor['id'],
                    'name': existing_monitor['friendly_name'],
                    'url': target['url'],
                    'status': 'existing'
                })
            else:
                monitor_id = self.create_monitor(
                    target['url'], 
                    target['name'], 
                    interval=target['interval']
                )
                
                if monitor_id:
                    created_monitors.append({
                        'id': monitor_id,
                        'name': target['name'],
                        'url': target['url'],
                        'status': 'created'
                    })
        
        return created_monitors
    
    def create_alert_contacts(self, contacts):
        """Create alert contacts for notifications."""
        created_contacts = []
        
        for contact in contacts:
            payload = {
                'api_key': self.api_key,
                'format': 'json',
                'type': contact['type'],  # 2 = email, 3 = SMS, 6 = webhook
                'value': contact['value'],
                'friendly_name': contact.get('name', f"Contact {contact['value']}")
            }
            
            try:
                response = requests.post(f"{self.base_url}/newAlertContact", data=payload)
                result = response.json()
                
                if result.get('stat') == 'ok':
                    contact_id = result['alertcontact']['id']
                    logger.info(f"✓ Created alert contact '{contact['value']}': {contact_id}")
                    created_contacts.append({
                        'id': contact_id,
                        'type': contact['type'],
                        'value': contact['value'],
                        'name': contact.get('name')
                    })
                else:
                    logger.error(f"✗ Failed to create alert contact '{contact['value']}': {result.get('error', {}).get('message', 'Unknown error')}")
            
            except Exception as e:
                logger.error(f"✗ Error creating alert contact '{contact['value']}': {e}")
        
        return created_contacts
    
    def generate_status_page(self, monitors):
        """Generate a simple status page configuration."""
        status_page = {
            'title': 'MediaNest Documentation Status',
            'description': 'Status of MediaNest documentation services',
            'monitors': monitors,
            'last_updated': datetime.now().isoformat(),
            'links': {
                'homepage': 'https://medianest.com',
                'documentation': 'https://docs.medianest.com',
                'support': 'https://github.com/medianest/medianest/issues'
            }
        }
        
        return status_page

def main():
    parser = argparse.ArgumentParser(description='Setup uptime monitoring for documentation site')
    parser.add_argument('--api-key', help='UptimeRobot API key (or set UPTIMEROBOT_API_KEY env var)')
    parser.add_argument('--url', default='https://docs.medianest.com', help='Base URL to monitor')
    parser.add_argument('--email', help='Email for alerts')
    parser.add_argument('--webhook', help='Webhook URL for alerts')
    parser.add_argument('--report', help='Save setup report to JSON file', default='uptime-monitoring-report.json')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created without creating')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    # Get API key
    api_key = args.api_key or os.getenv('UPTIMEROBOT_API_KEY')
    if not api_key:
        logger.error("UptimeRobot API key required. Use --api-key or set UPTIMEROBOT_API_KEY env var")
        return 1
    
    if args.dry_run:
        logger.info("Running in DRY-RUN mode - no monitors will be created")
    
    setup = UptimeMonitoringSetup(api_key)
    
    try:
        # Test API connectivity
        monitors = setup.get_monitors()
        if monitors is None:
            logger.error("Failed to connect to UptimeRobot API")
            return 1
        
        if args.dry_run:
            logger.info(f"Would setup monitoring for {args.url}")
            logger.info("Monitoring targets would be:")
            targets = [
                args.url,
                f"{args.url}/getting-started/",
                f"{args.url}/api/",
                f"{args.url}/search/"
            ]
            for target in targets:
                logger.info(f"  - {target}")
            return 0
        
        # Setup monitoring
        created_monitors = setup.setup_docs_monitoring(args.url)
        
        # Setup alert contacts if provided
        created_contacts = []
        contacts = []
        
        if args.email:
            contacts.append({
                'type': 2,  # Email
                'value': args.email,
                'name': 'Documentation Alerts'
            })
        
        if args.webhook:
            contacts.append({
                'type': 6,  # Webhook
                'value': args.webhook,
                'name': 'Documentation Webhook'
            })
        
        if contacts:
            created_contacts = setup.create_alert_contacts(contacts)
        
        # Generate status page
        status_page = setup.generate_status_page(created_monitors)
        
        # Generate report
        report = {
            'setup_date': datetime.now().isoformat(),
            'base_url': args.url,
            'monitors': created_monitors,
            'alert_contacts': created_contacts,
            'status_page': status_page,
            'summary': {
                'monitors_created': len([m for m in created_monitors if m['status'] == 'created']),
                'monitors_existing': len([m for m in created_monitors if m['status'] == 'existing']),
                'alert_contacts_created': len(created_contacts)
            }
        }
        
        # Save report
        with open(args.report, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Setup complete. Report saved to {args.report}")
        
        # Print summary
        print("\n" + "="*50)
        print("UPTIME MONITORING SETUP COMPLETE")
        print("="*50)
        print(f"Monitors created: {report['summary']['monitors_created']}")
        print(f"Monitors existing: {report['summary']['monitors_existing']}")
        print(f"Alert contacts created: {report['summary']['alert_contacts_created']}")
        print(f"Base URL: {args.url}")
        
        if created_monitors:
            print("\nMonitors:")
            for monitor in created_monitors:
                status_icon = "✓" if monitor['status'] == 'created' else "="
                print(f"  {status_icon} {monitor['name']}: {monitor['url']}")
        
        print(f"\nReport saved to: {args.report}")
        print("="*50)
        
        return 0
    
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())