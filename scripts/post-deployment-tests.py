#!/usr/bin/env python3
"""
Post-deployment testing script for MediaNest documentation.
Validates deployed documentation site functionality and performance.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
import argparse
import logging
from urllib.parse import urljoin, urlparse
import concurrent.futures
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class PostDeploymentTester:
    def __init__(self, base_url, timeout=30):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'MediaNest-DocsTest/1.0'
        })
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'base_url': base_url,
            'tests': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'warnings': 0
            }
        }
    
    def run_all_tests(self):
        """Run all post-deployment tests."""
        logger.info(f"Starting post-deployment tests for {self.base_url}")
        
        test_methods = [
            self._test_basic_connectivity,
            self._test_essential_pages,
            self._test_navigation_structure,
            self._test_search_functionality,
            self._test_responsive_design,
            self._test_performance_metrics,
            self._test_security_headers,
            self._test_seo_basics,
            self._test_accessibility_basics,
            self._test_error_handling
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                self._add_result('error', test_method.__name__, f'Test failed with exception: {e}')
        
        # Calculate summary
        self.results['summary']['total'] = len(self.results['tests'])
        self.results['summary']['passed'] = len([t for t in self.results['tests'] if t['status'] == 'pass'])
        self.results['summary']['failed'] = len([t for t in self.results['tests'] if t['status'] == 'fail'])
        self.results['summary']['warnings'] = len([t for t in self.results['tests'] if t['status'] == 'warning'])
        
        return self.results['summary']['failed'] == 0
    
    def _add_result(self, status, test_name, message, details=None):
        """Add a test result."""
        result = {
            'test': test_name,
            'status': status,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        if details:
            result['details'] = details
        
        self.results['tests'].append(result)
        
        # Log result
        if status == 'pass':
            logger.info(f"✓ {test_name}: {message}")
        elif status == 'warning':
            logger.warning(f"⚠ {test_name}: {message}")
        else:
            logger.error(f"✗ {test_name}: {message}")
    
    def _test_basic_connectivity(self):
        """Test basic connectivity to the documentation site."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            
            if response.status_code == 200:
                self._add_result('pass', 'basic_connectivity', 
                               f'Site accessible (HTTP {response.status_code})')
            else:
                self._add_result('fail', 'basic_connectivity', 
                               f'Site returned HTTP {response.status_code}')
        
        except requests.exceptions.Timeout:
            self._add_result('fail', 'basic_connectivity', 
                           f'Connection timeout after {self.timeout}s')
        except requests.exceptions.ConnectionError:
            self._add_result('fail', 'basic_connectivity', 
                           'Cannot connect to site')
        except Exception as e:
            self._add_result('fail', 'basic_connectivity', f'Connection error: {e}')
    
    def _test_essential_pages(self):
        """Test that essential documentation pages are accessible."""
        essential_pages = [
            '/',
            '/getting-started/',
            '/installation/',
            '/user-guides/',
            '/api/',
            '/developers/',
            '/troubleshooting/',
            '/reference/'
        ]
        
        failed_pages = []
        slow_pages = []
        
        def test_page(page_path):
            url = urljoin(self.base_url, page_path)
            try:
                start_time = time.time()
                response = self.session.get(url, timeout=self.timeout)
                load_time = time.time() - start_time
                
                if response.status_code != 200:
                    return {'path': page_path, 'status': response.status_code, 'error': 'HTTP error'}
                
                if load_time > 5.0:  # Slow page threshold
                    return {'path': page_path, 'load_time': load_time, 'warning': 'slow_load'}
                
                return {'path': page_path, 'status': 200, 'load_time': load_time}
            
            except Exception as e:
                return {'path': page_path, 'error': str(e)}
        
        # Test pages concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            page_results = list(executor.map(test_page, essential_pages))
        
        for result in page_results:
            if 'error' in result:
                failed_pages.append(result)
            elif result.get('warning') == 'slow_load':
                slow_pages.append(result)
        
        if not failed_pages:
            self._add_result('pass', 'essential_pages', 
                           f'All {len(essential_pages)} essential pages accessible')
        else:
            self._add_result('fail', 'essential_pages', 
                           f'{len(failed_pages)} essential pages failed', 
                           {'failed_pages': failed_pages})
        
        if slow_pages:
            self._add_result('warning', 'page_load_times', 
                           f'{len(slow_pages)} pages loaded slowly (>5s)', 
                           {'slow_pages': slow_pages})
    
    def _test_navigation_structure(self):
        """Test that the navigation structure is working."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            if response.status_code != 200:
                self._add_result('fail', 'navigation_structure', 'Cannot access home page')
                return
            
            content = response.text
            
            # Check for navigation elements
            nav_indicators = [
                '<nav',
                'navigation',
                'menu',
                'Getting Started',
                'Installation',
                'User Guides',
                'API',
                'Developers'
            ]
            
            found_nav = sum(1 for indicator in nav_indicators if indicator.lower() in content.lower())
            
            if found_nav >= 5:
                self._add_result('pass', 'navigation_structure', 
                               'Navigation structure appears complete')
            else:
                self._add_result('warning', 'navigation_structure', 
                               f'Navigation structure may be incomplete ({found_nav}/{len(nav_indicators)} indicators found)')
        
        except Exception as e:
            self._add_result('fail', 'navigation_structure', f'Navigation test failed: {e}')
    
    def _test_search_functionality(self):
        """Test search functionality if available."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            if response.status_code != 200:
                return
            
            content = response.text.lower()
            
            # Check for search indicators
            search_indicators = [
                'search',
                'searchbox',
                'search-input',
                'query'
            ]
            
            has_search = any(indicator in content for indicator in search_indicators)
            
            if has_search:
                # Try to find search endpoint
                if '/search/' in content or 'search.json' in content:
                    self._add_result('pass', 'search_functionality', 
                                   'Search functionality appears to be implemented')
                else:
                    self._add_result('warning', 'search_functionality', 
                                   'Search UI found but endpoint unclear')
            else:
                self._add_result('warning', 'search_functionality', 
                               'No search functionality detected')
        
        except Exception as e:
            self._add_result('warning', 'search_functionality', f'Search test failed: {e}')
    
    def _test_responsive_design(self):
        """Test responsive design by checking viewport meta tag and CSS."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            if response.status_code != 200:
                return
            
            content = response.text
            
            # Check for viewport meta tag
            has_viewport = 'name="viewport"' in content
            
            # Check for responsive CSS indicators
            responsive_indicators = [
                '@media',
                'responsive',
                'mobile',
                'tablet',
                'max-width',
                'min-width'
            ]
            
            # Get CSS files to check
            import re
            css_links = re.findall(r'href=["\']([^"\']*\.css)["\']', content)
            
            has_responsive_css = False
            for css_link in css_links[:3]:  # Check first 3 CSS files
                try:
                    css_url = urljoin(self.base_url, css_link)
                    css_response = self.session.get(css_url, timeout=self.timeout)
                    if css_response.status_code == 200:
                        css_content = css_response.text.lower()
                        if any(indicator in css_content for indicator in responsive_indicators):
                            has_responsive_css = True
                            break
                except:
                    pass
            
            if has_viewport and has_responsive_css:
                self._add_result('pass', 'responsive_design', 
                               'Responsive design features detected')
            elif has_viewport or has_responsive_css:
                self._add_result('warning', 'responsive_design', 
                               'Partial responsive design features detected')
            else:
                self._add_result('fail', 'responsive_design', 
                               'No responsive design features detected')
        
        except Exception as e:
            self._add_result('warning', 'responsive_design', f'Responsive design test failed: {e}')
    
    def _test_performance_metrics(self):
        """Test basic performance metrics."""
        try:
            start_time = time.time()
            response = self.session.get(self.base_url, timeout=self.timeout)
            load_time = time.time() - start_time
            
            if response.status_code != 200:
                return
            
            # Check response time
            if load_time < 2.0:
                self._add_result('pass', 'performance_response_time', 
                               f'Good response time: {load_time:.2f}s')
            elif load_time < 5.0:
                self._add_result('warning', 'performance_response_time', 
                               f'Acceptable response time: {load_time:.2f}s')
            else:
                self._add_result('fail', 'performance_response_time', 
                               f'Slow response time: {load_time:.2f}s')
            
            # Check content size
            content_size = len(response.content)
            content_size_kb = content_size / 1024
            
            if content_size_kb < 100:
                self._add_result('pass', 'performance_content_size', 
                               f'Good content size: {content_size_kb:.1f}KB')
            elif content_size_kb < 300:
                self._add_result('warning', 'performance_content_size', 
                               f'Large content size: {content_size_kb:.1f}KB')
            else:
                self._add_result('fail', 'performance_content_size', 
                               f'Very large content size: {content_size_kb:.1f}KB')
            
            # Check for compression
            if 'gzip' in response.headers.get('content-encoding', '').lower():
                self._add_result('pass', 'performance_compression', 
                               'Content is compressed')
            else:
                self._add_result('warning', 'performance_compression', 
                               'Content is not compressed')
        
        except Exception as e:
            self._add_result('warning', 'performance_metrics', f'Performance test failed: {e}')
    
    def _test_security_headers(self):
        """Test for important security headers."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            if response.status_code != 200:
                return
            
            security_headers = {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': ['DENY', 'SAMEORIGIN'],
                'X-XSS-Protection': '1',
                'Referrer-Policy': None,  # Any value is good
                'Content-Security-Policy': None  # Any value is good
            }
            
            present_headers = []
            missing_headers = []
            
            for header, expected_value in security_headers.items():
                header_value = response.headers.get(header, '').lower()
                
                if header_value:
                    if expected_value is None:  # Any value is acceptable
                        present_headers.append(header)
                    elif isinstance(expected_value, list):
                        if any(val.lower() in header_value for val in expected_value):
                            present_headers.append(header)
                        else:
                            missing_headers.append(f"{header} (incorrect value)")
                    elif expected_value.lower() in header_value:
                        present_headers.append(header)
                    else:
                        missing_headers.append(f"{header} (incorrect value)")
                else:
                    missing_headers.append(header)
            
            if len(present_headers) >= 3:
                self._add_result('pass', 'security_headers', 
                               f'Good security headers ({len(present_headers)}/{len(security_headers)})')
            elif len(present_headers) >= 1:
                self._add_result('warning', 'security_headers', 
                               f'Some security headers present ({len(present_headers)}/{len(security_headers)})',
                               {'missing': missing_headers})
            else:
                self._add_result('fail', 'security_headers', 
                               'No security headers found',
                               {'missing': missing_headers})
        
        except Exception as e:
            self._add_result('warning', 'security_headers', f'Security headers test failed: {e}')
    
    def _test_seo_basics(self):
        """Test basic SEO elements."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            if response.status_code != 200:
                return
            
            content = response.text
            
            seo_checks = {
                'title': '<title>' in content,
                'meta_description': 'name="description"' in content,
                'meta_keywords': 'name="keywords"' in content,
                'canonical': 'rel="canonical"' in content,
                'robots': 'name="robots"' in content or 'robots.txt' in content,
                'sitemap': 'sitemap.xml' in content
            }
            
            passed_checks = sum(seo_checks.values())
            
            if passed_checks >= 4:
                self._add_result('pass', 'seo_basics', 
                               f'Good SEO basics ({passed_checks}/{len(seo_checks)} checks)')
            elif passed_checks >= 2:
                self._add_result('warning', 'seo_basics', 
                               f'Some SEO elements present ({passed_checks}/{len(seo_checks)} checks)')
            else:
                self._add_result('fail', 'seo_basics', 
                               f'Poor SEO basics ({passed_checks}/{len(seo_checks)} checks)')
        
        except Exception as e:
            self._add_result('warning', 'seo_basics', f'SEO test failed: {e}')
    
    def _test_accessibility_basics(self):
        """Test basic accessibility features."""
        try:
            response = self.session.get(self.base_url, timeout=self.timeout)
            if response.status_code != 200:
                return
            
            content = response.text.lower()
            
            accessibility_checks = {
                'lang_attribute': 'lang=' in content,
                'alt_attributes': 'alt=' in content,
                'aria_labels': 'aria-label' in content or 'aria-labelledby' in content,
                'skip_links': 'skip' in content and 'content' in content,
                'semantic_html': any(tag in content for tag in ['<nav', '<main', '<header', '<footer']),
                'focus_management': 'tabindex' in content
            }
            
            passed_checks = sum(accessibility_checks.values())
            
            if passed_checks >= 4:
                self._add_result('pass', 'accessibility_basics', 
                               f'Good accessibility features ({passed_checks}/{len(accessibility_checks)} checks)')
            elif passed_checks >= 2:
                self._add_result('warning', 'accessibility_basics', 
                               f'Some accessibility features ({passed_checks}/{len(accessibility_checks)} checks)')
            else:
                self._add_result('fail', 'accessibility_basics', 
                               f'Poor accessibility support ({passed_checks}/{len(accessibility_checks)} checks)')
        
        except Exception as e:
            self._add_result('warning', 'accessibility_basics', f'Accessibility test failed: {e}')
    
    def _test_error_handling(self):
        """Test error page handling."""
        try:
            # Test 404 page
            response = self.session.get(
                urljoin(self.base_url, '/this-page-does-not-exist-12345'), 
                timeout=self.timeout
            )
            
            if response.status_code == 404:
                # Check if it's a proper 404 page with content
                if len(response.text) > 100 and ('404' in response.text or 'not found' in response.text.lower()):
                    self._add_result('pass', 'error_handling', 
                                   'Proper 404 error page found')
                else:
                    self._add_result('warning', 'error_handling', 
                                   'Basic 404 response but page content unclear')
            else:
                self._add_result('warning', 'error_handling', 
                               f'Unexpected response for 404 test: HTTP {response.status_code}')
        
        except Exception as e:
            self._add_result('warning', 'error_handling', f'Error handling test failed: {e}')
    
    def generate_report(self):
        """Generate a human-readable test report."""
        report = "# Post-Deployment Test Report\n\n"
        
        # Summary
        summary = self.results['summary']
        status_emoji = "✅" if summary['failed'] == 0 else "❌"
        
        report += f"## Summary {status_emoji}\n\n"
        report += f"- **URL**: {self.results['base_url']}\n"
        report += f"- **Test Date**: {self.results['timestamp']}\n"
        report += f"- **Total Tests**: {summary['total']}\n"
        report += f"- **Passed**: {summary['passed']} ✅\n"
        report += f"- **Failed**: {summary['failed']} ❌\n"
        report += f"- **Warnings**: {summary['warnings']} ⚠️\n\n"
        
        # Test Results
        report += "## Test Results\n\n"
        
        for test in self.results['tests']:
            status_icon = {"pass": "✅", "fail": "❌", "warning": "⚠️"}.get(test['status'], "❓")
            report += f"### {status_icon} {test['test'].replace('_', ' ').title()}\n\n"
            report += f"{test['message']}\n\n"
            
            if 'details' in test:
                report += "**Details:**\n```json\n"
                report += json.dumps(test['details'], indent=2)
                report += "\n```\n\n"
        
        return report
    
    def save_results(self, filename='post-deployment-test-results.json'):
        """Save detailed results as JSON."""
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        logger.info(f"Test results saved to {filename}")

def main():
    parser = argparse.ArgumentParser(description='Post-deployment testing for documentation site')
    parser.add_argument('--url', required=True, help='Base URL of the deployed documentation')
    parser.add_argument('--timeout', type=int, default=30, help='Request timeout in seconds')
    parser.add_argument('--report', help='Save results to JSON file', default='post-deployment-test-results.json')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    tester = PostDeploymentTester(args.url, args.timeout)
    
    # Run tests
    success = tester.run_all_tests()
    
    # Print report
    print(tester.generate_report())
    
    # Save results
    tester.save_results(args.report)
    
    # Return exit code
    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())