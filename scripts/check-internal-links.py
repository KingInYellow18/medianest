#!/usr/bin/env python3
"""
Internal link checker for MediaNest documentation.
Validates internal links within the built documentation.
"""

import os
import sys
import re
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class InternalLinkChecker:
    def __init__(self, site_dir):
        self.site_dir = Path(site_dir)
        self.broken_links = []
        self.checked_links = set()
        self.file_map = self._build_file_map()
        
    def _build_file_map(self):
        """Build a map of all HTML files in the site."""
        file_map = {}
        for html_file in self.site_dir.rglob('*.html'):
            relative_path = html_file.relative_to(self.site_dir)
            # Map both with and without .html extension
            file_map[str(relative_path)] = html_file
            file_map[str(relative_path).replace('.html', '/')] = html_file
            file_map[str(relative_path).replace('/index.html', '/')] = html_file
        return file_map
    
    def check_file(self, html_file):
        """Check all internal links in a single HTML file."""
        logger.info(f"Checking links in {html_file}")
        
        with open(html_file, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        # Find all links
        links = soup.find_all('a', href=True)
        
        for link in links:
            href = link['href']
            if self._is_internal_link(href):
                self._check_internal_link(href, html_file)
    
    def _is_internal_link(self, href):
        """Check if a link is internal."""
        # Skip external links, mailto, tel, etc.
        if href.startswith(('http://', 'https://', 'mailto:', 'tel:', 'ftp://')):
            return False
        
        # Skip anchors on the same page
        if href.startswith('#'):
            return False
            
        # Skip JavaScript links
        if href.startswith('javascript:'):
            return False
            
        return True
    
    def _check_internal_link(self, href, source_file):
        """Check if an internal link is valid."""
        # Normalize the link
        link_key = (href, str(source_file))
        if link_key in self.checked_links:
            return
        
        self.checked_links.add(link_key)
        
        # Remove fragment/anchor
        clean_href = href.split('#')[0]
        if not clean_href:
            return  # Just an anchor, skip
        
        # Handle relative paths
        if clean_href.startswith('/'):
            # Absolute path from site root
            target_path = clean_href.lstrip('/')
        else:
            # Relative path from current file
            source_dir = Path(source_file).parent
            target_path = (source_dir / clean_href).relative_to(self.site_dir)
            target_path = str(target_path)
        
        # Check if target exists
        if not self._link_exists(target_path):
            self.broken_links.append({
                'source': str(source_file),
                'link': href,
                'target': target_path,
                'error': 'File not found'
            })
            logger.warning(f"Broken link: {href} in {source_file}")
    
    def _link_exists(self, target_path):
        """Check if a link target exists."""
        # Try exact match first
        if target_path in self.file_map:
            return True
        
        # Try with /index.html
        if target_path.endswith('/'):
            index_path = target_path + 'index.html'
            if index_path in self.file_map:
                return True
        
        # Try adding .html
        html_path = target_path + '.html'
        if html_path in self.file_map:
            return True
        
        # Try as directory with index.html
        index_path = target_path + '/index.html'
        if index_path in self.file_map:
            return True
        
        return False
    
    def check_all(self):
        """Check all HTML files in the site."""
        html_files = list(self.site_dir.rglob('*.html'))
        logger.info(f"Found {len(html_files)} HTML files to check")
        
        for html_file in html_files:
            self.check_file(html_file)
        
        return len(self.broken_links) == 0
    
    def generate_report(self):
        """Generate a report of broken links."""
        if not self.broken_links:
            return "✅ All internal links are valid!"
        
        report = f"❌ Found {len(self.broken_links)} broken internal links:\n\n"
        
        for broken_link in self.broken_links:
            report += f"- **{broken_link['link']}** in `{broken_link['source']}`\n"
            report += f"  Target: `{broken_link['target']}`\n"
            report += f"  Error: {broken_link['error']}\n\n"
        
        return report
    
    def save_report(self, filename='broken-links-report.json'):
        """Save the report as JSON."""
        report_data = {
            'total_broken_links': len(self.broken_links),
            'broken_links': self.broken_links,
            'status': 'success' if len(self.broken_links) == 0 else 'failed'
        }
        
        with open(filename, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        logger.info(f"Report saved to {filename}")

def main():
    parser = argparse.ArgumentParser(description='Check internal links in built documentation')
    parser.add_argument('site_dir', help='Path to the built site directory')
    parser.add_argument('--file', help='Check a specific HTML file instead of all files')
    parser.add_argument('--report', help='Save report to JSON file', default='broken-links-report.json')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    if not os.path.exists(args.site_dir):
        logger.error(f"Site directory not found: {args.site_dir}")
        return 1
    
    checker = InternalLinkChecker(args.site_dir)
    
    if args.file:
        if not os.path.exists(args.file):
            logger.error(f"File not found: {args.file}")
            return 1
        checker.check_file(args.file)
    else:
        checker.check_all()
    
    # Print report
    print(checker.generate_report())
    
    # Save report
    checker.save_report(args.report)
    
    # Return exit code
    return 0 if len(checker.broken_links) == 0 else 1

if __name__ == '__main__':
    sys.exit(main())