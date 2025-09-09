#!/usr/bin/env python3
"""
Mobile Responsiveness Tester for MediaNest Documentation
Tests responsive design, mobile usability, and cross-device compatibility.
"""

import os
import json
import time
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Set, Optional, Tuple, Any
import logging
import subprocess
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import re

@dataclass
class ResponsivenessIssue:
    """Represents a mobile responsiveness issue"""
    page_url: str
    device_type: str
    viewport_size: str
    issue_type: str
    severity: str  # 'critical', 'major', 'minor'
    message: str
    recommendation: str
    screenshot_path: Optional[str] = None
    element_selector: Optional[str] = None
    measured_value: Optional[str] = None

class MobileResponsivenessTester:
    """Comprehensive mobile responsiveness testing"""
    
    def __init__(self, site_url: str = "http://localhost:8000", site_dir: str = "site"):
        self.site_url = site_url
        self.site_dir = Path(site_dir)
        self.issues: List[ResponsivenessIssue] = []
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Device configurations for testing
        self.device_configs = {
            'mobile_small': {
                'viewport': (320, 568),
                'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'device_name': 'iPhone SE'
            },
            'mobile_medium': {
                'viewport': (375, 667),
                'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'device_name': 'iPhone 8'
            },
            'mobile_large': {
                'viewport': (414, 896),
                'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'device_name': 'iPhone 11 Pro Max'
            },
            'tablet_portrait': {
                'viewport': (768, 1024),
                'user_agent': 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'device_name': 'iPad'
            },
            'tablet_landscape': {
                'viewport': (1024, 768),
                'user_agent': 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'device_name': 'iPad Landscape'
            },
            'desktop_small': {
                'viewport': (1280, 720),
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'device_name': 'Small Desktop'
            }
        }
        
        # Responsive design checkpoints
        self.responsive_tests = [
            'navigation_usability',
            'content_readability',
            'button_touch_targets',
            'form_usability',
            'image_scaling',
            'text_sizing',
            'horizontal_scrolling',
            'viewport_configuration',
            'touch_interactions',
            'loading_performance'
        ]
        
        # Screenshots directory
        self.screenshots_dir = Path("tests/docs-qa/screenshots")
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
    
    def test_responsiveness(self) -> Dict[str, Any]:
        """Run comprehensive mobile responsiveness tests"""
        self.logger.info("Starting comprehensive mobile responsiveness testing")
        
        # Check if site is running
        if not self._check_site_availability():
            self.logger.error(f"Site not available at {self.site_url}")
            return {
                'error': f"Site not available at {self.site_url}",
                'recommendation': "Start the development server with 'mkdocs serve' before running tests"
            }
        
        # Get list of pages to test
        pages_to_test = self._get_pages_to_test()
        self.logger.info(f"Testing {len(pages_to_test)} pages across {len(self.device_configs)} device configurations")
        
        # Initialize webdriver
        driver = self._init_webdriver()
        
        try:
            # Test each page on each device configuration
            for page_url in pages_to_test:
                for device_type, device_config in self.device_configs.items():
                    self._test_page_responsiveness(driver, page_url, device_type, device_config)
            
        finally:
            driver.quit()
        
        # Generate comprehensive report
        report = self._generate_responsiveness_report()
        
        return report
    
    def _check_site_availability(self) -> bool:
        """Check if the documentation site is running"""
        try:
            response = requests.get(self.site_url, timeout=10)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def _get_pages_to_test(self) -> List[str]:
        """Get list of pages to test for responsiveness"""
        pages = [self.site_url]  # Start with home page
        
        try:
            # Get sitemap or discover pages
            response = requests.get(f"{self.site_url}/sitemap.xml", timeout=10)
            if response.status_code == 200:
                # Parse sitemap to get all URLs
                import xml.etree.ElementTree as ET
                root = ET.fromstring(response.content)
                
                for url_elem in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'):
                    loc_elem = url_elem.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')
                    if loc_elem is not None:
                        pages.append(loc_elem.text)
            else:
                # Fallback: test common pages
                common_pages = [
                    '',
                    'getting-started/',
                    'installation/',
                    'user-guides/',
                    'api/',
                    'developers/',
                    'troubleshooting/'
                ]
                
                for page in common_pages:
                    page_url = f"{self.site_url.rstrip('/')}/{page}"
                    pages.append(page_url)
        
        except Exception as e:
            self.logger.warning(f"Could not discover pages: {e}")
            # Use basic page list
            pages = [
                self.site_url,
                f"{self.site_url}/getting-started/",
                f"{self.site_url}/api/"
            ]
        
        return pages[:10]  # Limit to prevent excessive testing
    
    def _init_webdriver(self) -> webdriver.Chrome:
        """Initialize Chrome webdriver for testing"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-background-timer-throttling')
        
        # Add mobile emulation capabilities
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
        
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.set_page_load_timeout(30)
            return driver
        except Exception as e:
            self.logger.error(f"Failed to initialize webdriver: {e}")
            raise
    
    def _test_page_responsiveness(self, driver: webdriver.Chrome, page_url: str, 
                                device_type: str, device_config: Dict[str, Any]):
        """Test responsiveness of a single page on a specific device"""
        try:
            # Configure device emulation
            viewport = device_config['viewport']
            user_agent = device_config['user_agent']
            
            # Set viewport size
            driver.set_window_size(viewport[0], viewport[1])
            
            # Set user agent
            driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                "userAgent": user_agent
            })
            
            # Navigate to page
            driver.get(page_url)
            
            # Wait for page to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Run responsive design tests
            self._test_navigation_usability(driver, page_url, device_type, device_config)
            self._test_content_readability(driver, page_url, device_type, device_config)
            self._test_button_touch_targets(driver, page_url, device_type, device_config)
            self._test_form_usability(driver, page_url, device_type, device_config)
            self._test_image_scaling(driver, page_url, device_type, device_config)
            self._test_horizontal_scrolling(driver, page_url, device_type, device_config)
            self._test_viewport_configuration(driver, page_url, device_type, device_config)
            self._test_text_sizing(driver, page_url, device_type, device_config)
            
            # Take screenshot for visual verification
            screenshot_path = self._take_screenshot(driver, page_url, device_type)
            
        except Exception as e:
            self._add_issue(
                page_url, device_type, f"{viewport[0]}x{viewport[1]}",
                'page_load_error', 'critical',
                f"Failed to test page: {e}",
                "Check page accessibility and fix any loading issues"
            )
    
    def _test_navigation_usability(self, driver: webdriver.Chrome, page_url: str, 
                                 device_type: str, device_config: Dict[str, Any]):
        """Test navigation usability on mobile devices"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            # Check for mobile navigation menu
            nav_elements = driver.find_elements(By.CSS_SELECTOR, "nav, .nav, [role='navigation']")
            
            if not nav_elements:
                self._add_issue(
                    page_url, device_type, viewport_str,
                    'navigation_missing', 'major',
                    "No navigation elements found on page",
                    "Add proper navigation structure for mobile users"
                )
                return
            
            # Check for hamburger menu on mobile
            if viewport[0] <= 768:  # Mobile viewport
                hamburger_selectors = [
                    ".hamburger", ".menu-toggle", ".nav-toggle", 
                    "[data-toggle='navigation']", ".mobile-menu-toggle"
                ]
                
                hamburger_found = False
                for selector in hamburger_selectors:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        hamburger_found = True
                        
                        # Test if hamburger menu is clickable
                        element = elements[0]
                        if not element.is_displayed():
                            self._add_issue(
                                page_url, device_type, viewport_str,
                                'navigation_hidden', 'major',
                                "Mobile navigation toggle not visible",
                                "Ensure hamburger menu is visible and accessible on mobile",
                                element_selector=selector
                            )
                        
                        # Check touch target size
                        size = element.size
                        if size['width'] < 44 or size['height'] < 44:
                            self._add_issue(
                                page_url, device_type, viewport_str,
                                'touch_target_small', 'major',
                                f"Navigation toggle too small ({size['width']}x{size['height']}px)",
                                "Increase touch target size to at least 44x44px",
                                element_selector=selector,
                                measured_value=f"{size['width']}x{size['height']}px"
                            )
                        break
                
                if not hamburger_found:
                    self._add_issue(
                        page_url, device_type, viewport_str,
                        'navigation_mobile_missing', 'major',
                        "No mobile navigation toggle found",
                        "Add hamburger menu or mobile navigation toggle"
                    )
            
            # Check navigation item spacing and accessibility
            nav_links = driver.find_elements(By.CSS_SELECTOR, "nav a, .nav a, [role='navigation'] a")
            
            for i, link in enumerate(nav_links[:5]):  # Check first 5 links
                if link.is_displayed():
                    size = link.size
                    if viewport[0] <= 768 and (size['width'] < 44 or size['height'] < 32):
                        self._add_issue(
                            page_url, device_type, viewport_str,
                            'nav_link_small', 'minor',
                            f"Navigation link {i+1} too small for touch interaction",
                            "Increase navigation link touch targets for mobile",
                            measured_value=f"{size['width']}x{size['height']}px"
                        )
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'navigation_test_error', 'minor',
                f"Error testing navigation: {e}",
                "Review navigation implementation"
            )
    
    def _test_content_readability(self, driver: webdriver.Chrome, page_url: str, 
                                device_type: str, device_config: Dict[str, Any]):
        """Test content readability on different screen sizes"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            # Check main content area
            content_selectors = ["main", ".main-content", ".content", "article", ".article"]
            main_content = None
            
            for selector in content_selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    main_content = elements[0]
                    break
            
            if not main_content:
                # Fallback to body
                main_content = driver.find_element(By.TAG_NAME, "body")
            
            # Check content width
            content_width = main_content.size['width']
            if content_width > viewport[0]:
                self._add_issue(
                    page_url, device_type, viewport_str,
                    'content_overflow', 'major',
                    f"Content width ({content_width}px) exceeds viewport ({viewport[0]}px)",
                    "Ensure content fits within viewport without horizontal scrolling",
                    measured_value=f"{content_width}px"
                )
            
            # Check text elements for readability
            text_elements = driver.find_elements(By.CSS_SELECTOR, "p, h1, h2, h3, h4, h5, h6, li")
            
            for element in text_elements[:10]:  # Check first 10 text elements
                if element.is_displayed():
                    # Check font size
                    font_size = driver.execute_script(
                        "return window.getComputedStyle(arguments[0]).fontSize;", element
                    )
                    
                    if font_size:
                        size_value = float(re.findall(r'\d+', font_size)[0]) if re.findall(r'\d+', font_size) else 0
                        
                        # Check minimum font size for mobile
                        if viewport[0] <= 768 and size_value < 14:
                            self._add_issue(
                                page_url, device_type, viewport_str,
                                'font_size_small', 'minor',
                                f"Text too small for mobile reading ({font_size})",
                                "Increase font size to at least 14px for mobile devices",
                                measured_value=font_size
                            )
                        
                        # Check line height
                        line_height = driver.execute_script(
                            "return window.getComputedStyle(arguments[0]).lineHeight;", element
                        )
                        
                        if line_height and line_height != 'normal':
                            try:
                                line_height_value = float(re.findall(r'\d+\.?\d*', line_height)[0])
                                if line_height_value < 1.4:
                                    self._add_issue(
                                        page_url, device_type, viewport_str,
                                        'line_height_small', 'minor',
                                        f"Line height too small for readability ({line_height})",
                                        "Increase line height to at least 1.4 for better readability",
                                        measured_value=line_height
                                    )
                            except (IndexError, ValueError):
                                pass
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'readability_test_error', 'minor',
                f"Error testing content readability: {e}",
                "Review content styling and layout"
            )
    
    def _test_button_touch_targets(self, driver: webdriver.Chrome, page_url: str, 
                                 device_type: str, device_config: Dict[str, Any]):
        """Test button and interactive element touch targets"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        # Only test for mobile viewports
        if viewport[0] > 768:
            return
        
        try:
            # Find interactive elements
            interactive_selectors = [
                "button", "a", "input[type='submit']", "input[type='button']",
                ".btn", ".button", "[role='button']", "[onclick]"
            ]
            
            for selector in interactive_selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                
                for element in elements:
                    if element.is_displayed():
                        size = element.size
                        
                        # Check minimum touch target size (44x44px recommended)
                        if size['width'] < 44 or size['height'] < 44:
                            element_tag = element.tag_name
                            element_text = element.text[:30] + "..." if len(element.text) > 30 else element.text
                            
                            self._add_issue(
                                page_url, device_type, viewport_str,
                                'touch_target_small', 'major',
                                f"Touch target too small: {element_tag} '{element_text}' ({size['width']}x{size['height']}px)",
                                "Increase touch target size to at least 44x44px for mobile accessibility",
                                element_selector=selector,
                                measured_value=f"{size['width']}x{size['height']}px"
                            )
                        
                        # Check spacing between interactive elements
                        try:
                            location = element.location
                            nearby_elements = driver.find_elements(By.CSS_SELECTOR, 
                                                                 ", ".join(interactive_selectors))
                            
                            for nearby in nearby_elements:
                                if nearby != element and nearby.is_displayed():
                                    nearby_location = nearby.location
                                    distance = abs(location['x'] - nearby_location['x']) + abs(location['y'] - nearby_location['y'])
                                    
                                    if distance < 8:  # Too close
                                        self._add_issue(
                                            page_url, device_type, viewport_str,
                                            'touch_targets_close', 'minor',
                                            f"Interactive elements too close together ({distance}px)",
                                            "Increase spacing between touch targets to prevent accidental taps",
                                            measured_value=f"{distance}px"
                                        )
                                        break
                        except Exception:
                            pass  # Skip spacing check if elements can't be located
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'touch_target_test_error', 'minor',
                f"Error testing touch targets: {e}",
                "Review interactive element sizing"
            )
    
    def _test_form_usability(self, driver: webdriver.Chrome, page_url: str, 
                           device_type: str, device_config: Dict[str, Any]):
        """Test form usability on mobile devices"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            forms = driver.find_elements(By.TAG_NAME, "form")
            
            for form in forms:
                if form.is_displayed():
                    # Check form inputs
                    inputs = form.find_elements(By.CSS_SELECTOR, "input, select, textarea")
                    
                    for input_elem in inputs:
                        if input_elem.is_displayed():
                            # Check input size
                            size = input_elem.size
                            input_type = input_elem.get_attribute('type') or 'text'
                            
                            if viewport[0] <= 768 and size['height'] < 44:
                                self._add_issue(
                                    page_url, device_type, viewport_str,
                                    'form_input_small', 'major',
                                    f"Form input too small for mobile ({size['width']}x{size['height']}px)",
                                    "Increase form input height to at least 44px for mobile",
                                    measured_value=f"{size['width']}x{size['height']}px"
                                )
                            
                            # Check for mobile-appropriate input types
                            if input_type == 'text':
                                name = input_elem.get_attribute('name') or ''
                                placeholder = input_elem.get_attribute('placeholder') or ''
                                
                                if 'email' in name.lower() or 'email' in placeholder.lower():
                                    self._add_issue(
                                        page_url, device_type, viewport_str,
                                        'input_type_generic', 'minor',
                                        "Email field uses generic text input type",
                                        "Use input type='email' for better mobile keyboard",
                                        element_selector=f"input[name='{name}']"
                                    )
                                elif 'phone' in name.lower() or 'tel' in name.lower():
                                    self._add_issue(
                                        page_url, device_type, viewport_str,
                                        'input_type_generic', 'minor',
                                        "Phone field uses generic text input type",
                                        "Use input type='tel' for numeric keyboard on mobile",
                                        element_selector=f"input[name='{name}']"
                                    )
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'form_test_error', 'minor',
                f"Error testing form usability: {e}",
                "Review form implementation"
            )
    
    def _test_image_scaling(self, driver: webdriver.Chrome, page_url: str, 
                          device_type: str, device_config: Dict[str, Any]):
        """Test image scaling and responsiveness"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            images = driver.find_elements(By.TAG_NAME, "img")
            
            for img in images:
                if img.is_displayed():
                    # Check if image overflows viewport
                    img_width = img.size['width']
                    
                    if img_width > viewport[0]:
                        src = img.get_attribute('src') or 'unknown'
                        self._add_issue(
                            page_url, device_type, viewport_str,
                            'image_overflow', 'major',
                            f"Image wider than viewport: {src} ({img_width}px > {viewport[0]}px)",
                            "Make images responsive with max-width: 100%",
                            measured_value=f"{img_width}px"
                        )
                    
                    # Check for missing responsive attributes
                    if not img.get_attribute('style') or 'max-width' not in img.get_attribute('style'):
                        # Check CSS for responsive styling
                        max_width = driver.execute_script(
                            "return window.getComputedStyle(arguments[0]).maxWidth;", img
                        )
                        
                        if max_width != '100%' and img_width > 300:  # Large images should be responsive
                            self._add_issue(
                                page_url, device_type, viewport_str,
                                'image_not_responsive', 'minor',
                                "Large image may not be responsive",
                                "Add max-width: 100% to image CSS for responsiveness"
                            )
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'image_test_error', 'minor',
                f"Error testing image scaling: {e}",
                "Review image implementation"
            )
    
    def _test_horizontal_scrolling(self, driver: webdriver.Chrome, page_url: str, 
                                 device_type: str, device_config: Dict[str, Any]):
        """Test for unwanted horizontal scrolling"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            # Check document width
            body_width = driver.execute_script("return document.body.scrollWidth;")
            viewport_width = viewport[0]
            
            if body_width > viewport_width:
                overflow = body_width - viewport_width
                self._add_issue(
                    page_url, device_type, viewport_str,
                    'horizontal_scroll', 'major',
                    f"Page has horizontal scroll: content {body_width}px > viewport {viewport_width}px (overflow: {overflow}px)",
                    "Fix content overflow to prevent horizontal scrolling",
                    measured_value=f"{body_width}px content in {viewport_width}px viewport"
                )
            
            # Check for specific overflowing elements
            all_elements = driver.find_elements(By.CSS_SELECTOR, "*")
            
            for element in all_elements:
                try:
                    if element.is_displayed():
                        element_right = driver.execute_script(
                            "return arguments[0].getBoundingClientRect().right;", element
                        )
                        
                        if element_right > viewport_width + 5:  # Allow small margin for rounding
                            tag_name = element.tag_name
                            class_name = element.get_attribute('class') or ''
                            
                            self._add_issue(
                                page_url, device_type, viewport_str,
                                'element_overflow', 'minor',
                                f"Element extends beyond viewport: {tag_name}.{class_name}",
                                "Adjust element width or add responsive styling",
                                element_selector=f"{tag_name}.{class_name}" if class_name else tag_name
                            )
                            break  # Only report first overflowing element
                except Exception:
                    continue  # Skip elements that can't be measured
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'scroll_test_error', 'minor',
                f"Error testing horizontal scrolling: {e}",
                "Review page layout"
            )
    
    def _test_viewport_configuration(self, driver: webdriver.Chrome, page_url: str, 
                                   device_type: str, device_config: Dict[str, Any]):
        """Test viewport meta tag configuration"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            # Check for viewport meta tag
            viewport_meta = driver.find_elements(By.CSS_SELECTOR, "meta[name='viewport']")
            
            if not viewport_meta:
                self._add_issue(
                    page_url, device_type, viewport_str,
                    'viewport_meta_missing', 'critical',
                    "Missing viewport meta tag",
                    "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to HTML head"
                )
            else:
                viewport_content = viewport_meta[0].get_attribute('content')
                
                # Check viewport content
                if 'width=device-width' not in viewport_content:
                    self._add_issue(
                        page_url, device_type, viewport_str,
                        'viewport_width_missing', 'major',
                        "Viewport meta tag missing width=device-width",
                        "Add width=device-width to viewport meta tag",
                        measured_value=viewport_content
                    )
                
                if 'initial-scale=1' not in viewport_content:
                    self._add_issue(
                        page_url, device_type, viewport_str,
                        'viewport_scale_missing', 'minor',
                        "Viewport meta tag missing initial-scale=1",
                        "Add initial-scale=1 to viewport meta tag",
                        measured_value=viewport_content
                    )
                
                # Check for problematic viewport settings
                if 'user-scalable=no' in viewport_content:
                    self._add_issue(
                        page_url, device_type, viewport_str,
                        'viewport_zoom_disabled', 'major',
                        "Viewport disables user scaling (accessibility issue)",
                        "Remove user-scalable=no to allow users to zoom",
                        measured_value=viewport_content
                    )
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'viewport_test_error', 'minor',
                f"Error testing viewport configuration: {e}",
                "Review viewport meta tag"
            )
    
    def _test_text_sizing(self, driver: webdriver.Chrome, page_url: str, 
                        device_type: str, device_config: Dict[str, Any]):
        """Test text sizing and scaling"""
        viewport = device_config['viewport']
        viewport_str = f"{viewport[0]}x{viewport[1]}"
        
        try:
            # Test heading sizes
            headings = driver.find_elements(By.CSS_SELECTOR, "h1, h2, h3, h4, h5, h6")
            
            for heading in headings:
                if heading.is_displayed():
                    font_size = driver.execute_script(
                        "return window.getComputedStyle(arguments[0]).fontSize;", heading
                    )
                    
                    if font_size:
                        size_value = float(re.findall(r'\d+', font_size)[0]) if re.findall(r'\d+', font_size) else 0
                        heading_level = heading.tag_name
                        
                        # Check heading size appropriateness for mobile
                        if viewport[0] <= 768:
                            if heading_level == 'H1' and size_value < 24:
                                self._add_issue(
                                    page_url, device_type, viewport_str,
                                    'heading_size_small', 'minor',
                                    f"H1 heading too small for mobile ({font_size})",
                                    "Increase H1 font size for better mobile hierarchy",
                                    measured_value=font_size
                                )
                            elif heading_level == 'H2' and size_value < 20:
                                self._add_issue(
                                    page_url, device_type, viewport_str,
                                    'heading_size_small', 'minor',
                                    f"H2 heading too small for mobile ({font_size})",
                                    "Increase H2 font size for better mobile readability",
                                    measured_value=font_size
                                )
        
        except Exception as e:
            self._add_issue(
                page_url, device_type, viewport_str,
                'text_sizing_error', 'minor',
                f"Error testing text sizing: {e}",
                "Review text sizing implementation"
            )
    
    def _take_screenshot(self, driver: webdriver.Chrome, page_url: str, device_type: str) -> Optional[str]:
        """Take screenshot for visual verification"""
        try:
            # Create filename
            page_name = page_url.replace(self.site_url, '').replace('/', '_').strip('_') or 'home'
            filename = f"{page_name}_{device_type}.png"
            screenshot_path = self.screenshots_dir / filename
            
            # Take screenshot
            driver.save_screenshot(str(screenshot_path))
            
            return str(screenshot_path)
        
        except Exception as e:
            self.logger.warning(f"Failed to take screenshot: {e}")
            return None
    
    def _add_issue(self, page_url: str, device_type: str, viewport_size: str, 
                   issue_type: str, severity: str, message: str, recommendation: str,
                   screenshot_path: Optional[str] = None, element_selector: Optional[str] = None,
                   measured_value: Optional[str] = None):
        """Add a responsiveness issue to the results"""
        issue = ResponsivenessIssue(
            page_url=page_url,
            device_type=device_type,
            viewport_size=viewport_size,
            issue_type=issue_type,
            severity=severity,
            message=message,
            recommendation=recommendation,
            screenshot_path=screenshot_path,
            element_selector=element_selector,
            measured_value=measured_value
        )
        self.issues.append(issue)
    
    def _generate_responsiveness_report(self) -> Dict[str, Any]:
        """Generate comprehensive responsiveness report"""
        # Group issues by various criteria
        by_severity = {'critical': [], 'major': [], 'minor': []}
        by_device = {}
        by_page = {}
        by_type = {}
        
        for issue in self.issues:
            by_severity[issue.severity].append(issue)
            
            if issue.device_type not in by_device:
                by_device[issue.device_type] = []
            by_device[issue.device_type].append(issue)
            
            if issue.page_url not in by_page:
                by_page[issue.page_url] = []
            by_page[issue.page_url].append(issue)
            
            if issue.issue_type not in by_type:
                by_type[issue.issue_type] = []
            by_type[issue.issue_type].append(issue)
        
        # Calculate responsiveness score
        total_issues = len(self.issues)
        critical_count = len(by_severity['critical'])
        major_count = len(by_severity['major'])
        minor_count = len(by_severity['minor'])
        
        # Responsiveness score (0-100)
        responsiveness_score = max(0, 100 - (critical_count * 20) - (major_count * 5) - (minor_count * 1))
        
        # Device compatibility assessment
        device_compatibility = {}
        for device_type in self.device_configs.keys():
            device_issues = by_device.get(device_type, [])
            device_critical = len([i for i in device_issues if i.severity == 'critical'])
            device_major = len([i for i in device_issues if i.severity == 'major'])
            
            if device_critical > 0:
                device_compatibility[device_type] = 'poor'
            elif device_major > 2:
                device_compatibility[device_type] = 'fair'
            elif len(device_issues) > 0:
                device_compatibility[device_type] = 'good'
            else:
                device_compatibility[device_type] = 'excellent'
        
        report = {
            'summary': {
                'total_issues': total_issues,
                'critical_issues': critical_count,
                'major_issues': major_count,
                'minor_issues': minor_count,
                'responsiveness_score': round(responsiveness_score, 1),
                'pages_tested': len(by_page),
                'devices_tested': len(self.device_configs),
                'device_compatibility': device_compatibility
            },
            'issues_by_device': {
                device: {
                    'total': len(issues),
                    'critical': len([i for i in issues if i.severity == 'critical']),
                    'major': len([i for i in issues if i.severity == 'major']),
                    'minor': len([i for i in issues if i.severity == 'minor'])
                }
                for device, issues in by_device.items()
            },
            'issues_by_page': {
                page: {
                    'total': len(issues),
                    'critical': len([i for i in issues if i.severity == 'critical']),
                    'major': len([i for i in issues if i.severity == 'major']),
                    'minor': len([i for i in issues if i.severity == 'minor'])
                }
                for page, issues in by_page.items()
            },
            'issues_by_type': {
                issue_type: len(issues) 
                for issue_type, issues in by_type.items()
            },
            'detailed_issues': [
                {
                    'page': issue.page_url,
                    'device': issue.device_type,
                    'viewport': issue.viewport_size,
                    'type': issue.issue_type,
                    'severity': issue.severity,
                    'message': issue.message,
                    'recommendation': issue.recommendation,
                    'element_selector': issue.element_selector,
                    'measured_value': issue.measured_value,
                    'screenshot': issue.screenshot_path
                }
                for issue in sorted(self.issues, key=lambda x: (x.severity, x.page_url, x.device_type))
            ],
            'recommendations': self._generate_responsiveness_recommendations(by_type, by_severity, device_compatibility)
        }
        
        return report
    
    def _generate_responsiveness_recommendations(self, by_type: Dict[str, List], 
                                               by_severity: Dict[str, List],
                                               device_compatibility: Dict[str, str]) -> List[str]:
        """Generate actionable responsiveness recommendations"""
        recommendations = []
        
        if by_severity['critical']:
            recommendations.append("🚨 Fix all critical responsiveness issues immediately")
        
        if 'viewport_meta_missing' in by_type:
            recommendations.append("📱 Add proper viewport meta tag to all pages")
        
        if 'horizontal_scroll' in by_type:
            recommendations.append("📐 Fix horizontal scrolling issues with responsive CSS")
        
        if 'touch_target_small' in by_type:
            recommendations.append("👆 Increase touch target sizes to at least 44x44px")
        
        if 'font_size_small' in by_type:
            recommendations.append("📝 Increase font sizes for better mobile readability")
        
        if 'navigation_mobile_missing' in by_type:
            recommendations.append("🍔 Add mobile navigation menu (hamburger menu)")
        
        if 'image_overflow' in by_type:
            recommendations.append("🖼️ Make images responsive with max-width: 100%")
        
        # Device-specific recommendations
        poor_devices = [device for device, quality in device_compatibility.items() if quality == 'poor']
        if poor_devices:
            recommendations.append(f"📱 Priority focus needed for: {', '.join(poor_devices)}")
        
        recommendations.extend([
            "📱 Test on real devices in addition to browser emulation",
            "🔄 Implement responsive design testing in CI/CD pipeline",
            "📊 Monitor mobile analytics and user feedback",
            "🎨 Consider mobile-first design approach",
            "⚡ Optimize performance for mobile networks",
            "🧪 Use browser dev tools device emulation during development"
        ])
        
        return recommendations

def main():
    """Main execution function"""
    tester = MobileResponsivenessTester()
    report = tester.test_responsiveness()
    
    if 'error' in report:
        print(f"❌ {report['error']}")
        print(f"💡 {report['recommendation']}")
        return
    
    # Save report
    report_path = Path("tests/docs-qa/mobile_responsiveness_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print(f"\n📱 Mobile Responsiveness Testing Complete!")
    print(f"🎯 Responsiveness Score: {report['summary']['responsiveness_score']}/100")
    print(f"🚨 Critical Issues: {report['summary']['critical_issues']}")
    print(f"⚠️  Major Issues: {report['summary']['major_issues']}")
    print(f"ℹ️  Minor Issues: {report['summary']['minor_issues']}")
    print(f"📄 Pages tested: {report['summary']['pages_tested']}")
    print(f"📱 Devices tested: {report['summary']['devices_tested']}")
    
    # Device compatibility
    print(f"\n📱 Device Compatibility:")
    for device, quality in report['summary']['device_compatibility'].items():
        emoji = {'excellent': '✅', 'good': '👍', 'fair': '⚠️', 'poor': '❌'}[quality]
        print(f"   {device}: {emoji} {quality.capitalize()}")
    
    print(f"\n📄 Report saved to: {report_path}")
    
    if report['summary']['critical_issues'] > 0:
        print(f"\n🚨 Critical responsiveness issues found:")
        critical_issues = [i for i in report['detailed_issues'] if i['severity'] == 'critical']
        for issue in critical_issues[:3]:
            print(f"  - {issue['device']}: {issue['message']}")

if __name__ == "__main__":
    main()