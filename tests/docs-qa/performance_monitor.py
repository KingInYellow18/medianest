#!/usr/bin/env python3
"""
Performance Monitor for MediaNest Documentation
Monitors build performance, search effectiveness, and user experience metrics.
"""

import os
import json
import time
import subprocess
import psutil
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Set, Optional, Tuple, Any
import logging
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import statistics
import threading
from datetime import datetime, timedelta

@dataclass
class PerformanceMetric:
    """Represents a performance metric measurement"""
    metric_name: str
    value: float
    unit: str
    timestamp: datetime
    context: Dict[str, Any] = None
    threshold_passed: bool = True
    recommendation: Optional[str] = None

class PerformanceMonitor:
    """Comprehensive performance monitoring for documentation"""
    
    def __init__(self, docs_dir: str = "docs", site_url: str = "http://localhost:8000"):
        self.docs_dir = Path(docs_dir)
        self.site_url = site_url
        self.metrics: List[PerformanceMetric] = []
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Performance thresholds
        self.thresholds = {
            'build_time': 60.0,  # seconds
            'page_load_time': 3.0,  # seconds
            'search_response_time': 0.5,  # seconds
            'first_contentful_paint': 2.0,  # seconds
            'largest_contentful_paint': 4.0,  # seconds
            'cumulative_layout_shift': 0.1,  # score
            'time_to_interactive': 5.0,  # seconds
            'memory_usage': 512,  # MB
            'cpu_usage': 80,  # percentage
            'bundle_size': 5,  # MB
            'image_optimization': 80,  # percentage
            'lighthouse_performance': 90,  # score
            'lighthouse_accessibility': 95,  # score
            'lighthouse_best_practices': 90,  # score
            'lighthouse_seo': 95  # score
        }
        
        # Monitoring data
        self.monitoring_data = {
            'build_metrics': [],
            'runtime_metrics': [],
            'user_experience_metrics': [],
            'resource_metrics': [],
            'search_metrics': []
        }
    
    def monitor_performance(self) -> Dict[str, Any]:
        """Run comprehensive performance monitoring"""
        self.logger.info("Starting comprehensive performance monitoring")
        
        # Monitor build performance
        build_metrics = self._monitor_build_performance()
        self.monitoring_data['build_metrics'] = build_metrics
        
        # Monitor runtime performance
        runtime_metrics = self._monitor_runtime_performance()
        self.monitoring_data['runtime_metrics'] = runtime_metrics
        
        # Monitor user experience
        ux_metrics = self._monitor_user_experience()
        self.monitoring_data['user_experience_metrics'] = ux_metrics
        
        # Monitor resource usage
        resource_metrics = self._monitor_resource_usage()
        self.monitoring_data['resource_metrics'] = resource_metrics
        
        # Monitor search performance
        search_metrics = self._monitor_search_performance()
        self.monitoring_data['search_metrics'] = search_metrics
        
        # Generate comprehensive report
        report = self._generate_performance_report()
        
        return report
    
    def _monitor_build_performance(self) -> Dict[str, Any]:
        """Monitor MkDocs build performance"""
        build_metrics = {
            'build_time': None,
            'file_count': 0,
            'total_size': 0,
            'memory_usage': [],
            'cpu_usage': [],
            'error_count': 0
        }
        
        try:
            # Monitor system resources during build
            resource_monitor = ResourceMonitor()
            monitor_thread = threading.Thread(target=resource_monitor.monitor, args=(1, 60))
            monitor_thread.daemon = True
            monitor_thread.start()
            
            # Start build process
            start_time = time.time()
            
            self.logger.info("Starting MkDocs build performance monitoring")
            
            # Run mkdocs build with timing
            process = subprocess.Popen(
                ['mkdocs', 'build', '--clean'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=self.docs_dir.parent
            )
            
            stdout, stderr = process.communicate()
            build_time = time.time() - start_time
            
            # Record build time
            build_metrics['build_time'] = build_time
            self._add_metric('build_time', build_time, 'seconds')
            
            # Count output files and size
            site_dir = self.docs_dir.parent / 'site'
            if site_dir.exists():
                file_count = 0
                total_size = 0
                
                for root, dirs, files in os.walk(site_dir):
                    for file in files:
                        file_path = Path(root) / file
                        file_count += 1
                        total_size += file_path.stat().st_size
                
                build_metrics['file_count'] = file_count
                build_metrics['total_size'] = total_size
                
                self._add_metric('output_files', file_count, 'files')
                self._add_metric('output_size', total_size / (1024 * 1024), 'MB')
            
            # Get resource usage during build
            build_metrics['memory_usage'] = resource_monitor.memory_usage
            build_metrics['cpu_usage'] = resource_monitor.cpu_usage
            
            # Count errors
            if process.returncode != 0:
                build_metrics['error_count'] = stderr.count('ERROR')
                self.logger.error(f"Build failed with errors: {stderr}")
            
            # Log build performance
            self.logger.info(f"Build completed in {build_time:.2f} seconds")
            self.logger.info(f"Generated {file_count} files ({total_size / (1024 * 1024):.1f} MB)")
            
        except Exception as e:
            self.logger.error(f"Error monitoring build performance: {e}")
            build_metrics['error'] = str(e)
        
        return build_metrics
    
    def _monitor_runtime_performance(self) -> Dict[str, Any]:
        """Monitor runtime performance of generated site"""
        runtime_metrics = {
            'page_load_times': {},
            'resource_load_times': {},
            'javascript_performance': {},
            'css_performance': {},
            'image_performance': {}
        }
        
        try:
            # Check if site is available
            if not self._check_site_availability():
                runtime_metrics['error'] = "Site not available for testing"
                return runtime_metrics
            
            # Initialize webdriver for performance testing
            driver = self._init_performance_webdriver()
            
            try:
                # Test key pages
                test_pages = [
                    '',
                    'getting-started/',
                    'api/',
                    'developers/'
                ]
                
                for page in test_pages:
                    page_url = f"{self.site_url.rstrip('/')}/{page}"
                    page_metrics = self._measure_page_performance(driver, page_url)
                    runtime_metrics['page_load_times'][page or 'home'] = page_metrics
                
                # Test resource loading
                runtime_metrics['resource_load_times'] = self._measure_resource_performance(driver)
                
                # Test JavaScript performance
                runtime_metrics['javascript_performance'] = self._measure_javascript_performance(driver)
                
            finally:
                driver.quit()
        
        except Exception as e:
            self.logger.error(f"Error monitoring runtime performance: {e}")
            runtime_metrics['error'] = str(e)
        
        return runtime_metrics
    
    def _monitor_user_experience(self) -> Dict[str, Any]:
        """Monitor user experience metrics"""
        ux_metrics = {
            'lighthouse_scores': {},
            'web_vitals': {},
            'accessibility_score': None,
            'mobile_friendliness': None
        }
        
        try:
            # Run Lighthouse audit if available
            lighthouse_scores = self._run_lighthouse_audit()
            ux_metrics['lighthouse_scores'] = lighthouse_scores
            
            # Measure Core Web Vitals
            web_vitals = self._measure_web_vitals()
            ux_metrics['web_vitals'] = web_vitals
            
            # Test mobile friendliness
            mobile_score = self._test_mobile_friendliness()
            ux_metrics['mobile_friendliness'] = mobile_score
            
        except Exception as e:
            self.logger.error(f"Error monitoring user experience: {e}")
            ux_metrics['error'] = str(e)
        
        return ux_metrics
    
    def _monitor_resource_usage(self) -> Dict[str, Any]:
        """Monitor resource usage and optimization"""
        resource_metrics = {
            'bundle_analysis': {},
            'image_optimization': {},
            'compression_analysis': {},
            'caching_analysis': {}
        }
        
        try:
            # Analyze bundle sizes
            resource_metrics['bundle_analysis'] = self._analyze_bundle_sizes()
            
            # Check image optimization
            resource_metrics['image_optimization'] = self._analyze_image_optimization()
            
            # Check compression
            resource_metrics['compression_analysis'] = self._analyze_compression()
            
            # Check caching headers
            resource_metrics['caching_analysis'] = self._analyze_caching()
            
        except Exception as e:
            self.logger.error(f"Error monitoring resource usage: {e}")
            resource_metrics['error'] = str(e)
        
        return resource_metrics
    
    def _monitor_search_performance(self) -> Dict[str, Any]:
        """Monitor search functionality performance"""
        search_metrics = {
            'search_index_size': 0,
            'search_response_times': [],
            'search_accuracy': {},
            'search_coverage': {}
        }
        
        try:
            # Check search index size
            search_index_path = self.docs_dir.parent / 'site' / 'search' / 'search_index.json'
            if search_index_path.exists():
                search_metrics['search_index_size'] = search_index_path.stat().st_size
                self._add_metric('search_index_size', search_metrics['search_index_size'] / 1024, 'KB')
            
            # Test search performance
            if self._check_site_availability():
                search_performance = self._test_search_performance()
                search_metrics.update(search_performance)
            
        except Exception as e:
            self.logger.error(f"Error monitoring search performance: {e}")
            search_metrics['error'] = str(e)
        
        return search_metrics
    
    def _check_site_availability(self) -> bool:
        """Check if documentation site is available"""
        try:
            response = requests.get(self.site_url, timeout=10)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def _init_performance_webdriver(self) -> webdriver.Chrome:
        """Initialize Chrome webdriver for performance testing"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-extensions')
        
        # Enable performance logging
        chrome_options.add_argument('--enable-logging')
        chrome_options.add_argument('--log-level=0')
        
        # Set performance preferences
        prefs = {
            'profile.default_content_setting_values.notifications': 2,
            'profile.default_content_settings.popups': 0,
            'profile.managed_default_content_settings.images': 2
        }
        chrome_options.add_experimental_option('prefs', prefs)
        
        # Enable performance monitoring
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
        
        return webdriver.Chrome(options=chrome_options)
    
    def _measure_page_performance(self, driver: webdriver.Chrome, page_url: str) -> Dict[str, Any]:
        """Measure performance metrics for a specific page"""
        page_metrics = {
            'load_time': None,
            'dom_content_loaded': None,
            'first_contentful_paint': None,
            'largest_contentful_paint': None,
            'time_to_interactive': None,
            'resource_count': 0,
            'total_size': 0
        }
        
        try:
            # Navigate to page and measure timing
            start_time = time.time()
            driver.get(page_url)
            
            # Wait for page to load
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            load_time = time.time() - start_time
            page_metrics['load_time'] = load_time
            
            # Get performance timing data
            navigation_timing = driver.execute_script("""
                var timing = window.performance.timing;
                return {
                    navigationStart: timing.navigationStart,
                    domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                    loadEventEnd: timing.loadEventEnd
                };
            """)
            
            if navigation_timing:
                nav_start = navigation_timing['navigationStart']
                dom_loaded = navigation_timing['domContentLoadedEventEnd']
                load_end = navigation_timing['loadEventEnd']
                
                if dom_loaded and nav_start:
                    page_metrics['dom_content_loaded'] = (dom_loaded - nav_start) / 1000
                
            # Get paint timing if available
            paint_timing = driver.execute_script("""
                var paints = performance.getEntriesByType('paint');
                var result = {};
                paints.forEach(function(paint) {
                    result[paint.name.replace('-', '_')] = paint.startTime / 1000;
                });
                return result;
            """)
            
            if paint_timing:
                page_metrics.update(paint_timing)
            
            # Get resource count and size
            resources = driver.execute_script("""
                var resources = performance.getEntriesByType('resource');
                var totalSize = 0;
                resources.forEach(function(resource) {
                    if (resource.transferSize) {
                        totalSize += resource.transferSize;
                    }
                });
                return {
                    count: resources.length,
                    totalSize: totalSize
                };
            """)
            
            if resources:
                page_metrics['resource_count'] = resources['count']
                page_metrics['total_size'] = resources['totalSize']
            
            # Record metrics
            self._add_metric(f'page_load_time_{page_url.split("/")[-1] or "home"}', load_time, 'seconds')
            
        except Exception as e:
            self.logger.error(f"Error measuring page performance for {page_url}: {e}")
            page_metrics['error'] = str(e)
        
        return page_metrics
    
    def _measure_resource_performance(self, driver: webdriver.Chrome) -> Dict[str, Any]:
        """Measure resource loading performance"""
        try:
            driver.get(self.site_url)
            
            # Get detailed resource timing
            resource_timing = driver.execute_script("""
                var resources = performance.getEntriesByType('resource');
                var byType = {};
                
                resources.forEach(function(resource) {
                    var type = 'other';
                    if (resource.name.includes('.css')) type = 'css';
                    else if (resource.name.includes('.js')) type = 'javascript';
                    else if (resource.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) type = 'image';
                    else if (resource.name.includes('.woff')) type = 'font';
                    
                    if (!byType[type]) byType[type] = [];
                    byType[type].push({
                        name: resource.name,
                        duration: resource.duration,
                        size: resource.transferSize || 0
                    });
                });
                
                return byType;
            """)
            
            return resource_timing
        
        except Exception as e:
            self.logger.error(f"Error measuring resource performance: {e}")
            return {}
    
    def _measure_javascript_performance(self, driver: webdriver.Chrome) -> Dict[str, Any]:
        """Measure JavaScript performance"""
        try:
            driver.get(self.site_url)
            
            # Measure JavaScript execution time
            js_performance = driver.execute_script("""
                var start = performance.now();
                
                // Simulate some JavaScript operations
                var elements = document.querySelectorAll('*');
                var elementCount = elements.length;
                
                // Test search functionality if available
                var searchBox = document.querySelector('input[type="search"], .search-input');
                var hasSearch = !!searchBox;
                
                var end = performance.now();
                
                return {
                    execution_time: (end - start) / 1000,
                    dom_elements: elementCount,
                    has_search: hasSearch,
                    memory_used: performance.memory ? performance.memory.usedJSHeapSize : null
                };
            """)
            
            return js_performance
        
        except Exception as e:
            self.logger.error(f"Error measuring JavaScript performance: {e}")
            return {}
    
    def _run_lighthouse_audit(self) -> Dict[str, Any]:
        """Run Lighthouse audit for performance metrics"""
        lighthouse_scores = {}
        
        try:
            # Try to run lighthouse CLI if available
            result = subprocess.run(
                ['lighthouse', self.site_url, '--output=json', '--quiet', '--chrome-flags="--headless"'],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                lighthouse_data = json.loads(result.stdout)
                categories = lighthouse_data.get('categories', {})
                
                for category_name, category_data in categories.items():
                    score = category_data.get('score', 0) * 100
                    lighthouse_scores[category_name] = score
                    self._add_metric(f'lighthouse_{category_name}', score, 'score')
            
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError) as e:
            self.logger.warning(f"Lighthouse audit not available: {e}")
            lighthouse_scores['error'] = 'Lighthouse CLI not available'
        
        return lighthouse_scores
    
    def _measure_web_vitals(self) -> Dict[str, Any]:
        """Measure Core Web Vitals"""
        web_vitals = {}
        
        try:
            driver = self._init_performance_webdriver()
            
            try:
                driver.get(self.site_url)
                
                # Measure web vitals using JavaScript
                vitals = driver.execute_script("""
                    return new Promise(function(resolve) {
                        var vitals = {};
                        
                        // Largest Contentful Paint
                        new PerformanceObserver(function(list) {
                            var entries = list.getEntries();
                            var lastEntry = entries[entries.length - 1];
                            vitals.lcp = lastEntry.startTime / 1000;
                        }).observe({entryTypes: ['largest-contentful-paint']});
                        
                        // First Input Delay (simulated)
                        document.addEventListener('click', function() {
                            vitals.fid_simulated = true;
                        }, {once: true});
                        
                        // Cumulative Layout Shift
                        var clsValue = 0;
                        new PerformanceObserver(function(list) {
                            for (var entry of list.getEntries()) {
                                if (!entry.hadRecentInput) {
                                    clsValue += entry.value;
                                }
                            }
                            vitals.cls = clsValue;
                        }).observe({entryTypes: ['layout-shift']});
                        
                        setTimeout(function() {
                            resolve(vitals);
                        }, 3000);
                    });
                """)
                
                if vitals:
                    web_vitals = vitals
                    
                    # Record metrics
                    if 'lcp' in vitals:
                        self._add_metric('largest_contentful_paint', vitals['lcp'], 'seconds')
                    if 'cls' in vitals:
                        self._add_metric('cumulative_layout_shift', vitals['cls'], 'score')
            
            finally:
                driver.quit()
        
        except Exception as e:
            self.logger.error(f"Error measuring web vitals: {e}")
            web_vitals['error'] = str(e)
        
        return web_vitals
    
    def _test_mobile_friendliness(self) -> Optional[float]:
        """Test mobile friendliness score"""
        try:
            # This would typically use Google's Mobile-Friendly Test API
            # For now, we'll do a basic check
            driver = self._init_performance_webdriver()
            
            try:
                # Set mobile viewport
                driver.set_window_size(375, 667)
                driver.get(self.site_url)
                
                # Check for mobile-friendly indicators
                mobile_score = 0
                
                # Check viewport meta tag
                viewport_meta = driver.find_elements(By.CSS_SELECTOR, "meta[name='viewport']")
                if viewport_meta:
                    mobile_score += 25
                
                # Check for responsive design
                body_width = driver.execute_script("return document.body.scrollWidth;")
                if body_width <= 375:
                    mobile_score += 25
                
                # Check touch targets
                buttons = driver.find_elements(By.CSS_SELECTOR, "button, a, input")
                good_touch_targets = 0
                for button in buttons[:10]:
                    if button.is_displayed():
                        size = button.size
                        if size['width'] >= 44 and size['height'] >= 44:
                            good_touch_targets += 1
                
                if good_touch_targets >= len(buttons[:10]) * 0.8:
                    mobile_score += 25
                
                # Check text readability
                text_elements = driver.find_elements(By.CSS_SELECTOR, "p, h1, h2, h3")
                readable_text = 0
                for element in text_elements[:5]:
                    if element.is_displayed():
                        font_size = driver.execute_script(
                            "return window.getComputedStyle(arguments[0]).fontSize;", element
                        )
                        if font_size and int(font_size.replace('px', '')) >= 14:
                            readable_text += 1
                
                if readable_text >= len(text_elements[:5]) * 0.8:
                    mobile_score += 25
                
                self._add_metric('mobile_friendliness', mobile_score, 'score')
                return mobile_score
            
            finally:
                driver.quit()
        
        except Exception as e:
            self.logger.error(f"Error testing mobile friendliness: {e}")
            return None
    
    def _analyze_bundle_sizes(self) -> Dict[str, Any]:
        """Analyze JavaScript and CSS bundle sizes"""
        bundle_analysis = {
            'css_files': [],
            'js_files': [],
            'total_css_size': 0,
            'total_js_size': 0
        }
        
        try:
            site_dir = self.docs_dir.parent / 'site'
            if not site_dir.exists():
                return bundle_analysis
            
            # Find CSS files
            for css_file in site_dir.rglob('*.css'):
                size = css_file.stat().st_size
                bundle_analysis['css_files'].append({
                    'name': css_file.name,
                    'size': size,
                    'path': str(css_file.relative_to(site_dir))
                })
                bundle_analysis['total_css_size'] += size
            
            # Find JavaScript files
            for js_file in site_dir.rglob('*.js'):
                size = js_file.stat().st_size
                bundle_analysis['js_files'].append({
                    'name': js_file.name,
                    'size': size,
                    'path': str(js_file.relative_to(site_dir))
                })
                bundle_analysis['total_js_size'] += size
            
            # Record metrics
            total_bundle_size = (bundle_analysis['total_css_size'] + bundle_analysis['total_js_size']) / (1024 * 1024)
            self._add_metric('total_bundle_size', total_bundle_size, 'MB')
        
        except Exception as e:
            self.logger.error(f"Error analyzing bundle sizes: {e}")
            bundle_analysis['error'] = str(e)
        
        return bundle_analysis
    
    def _analyze_image_optimization(self) -> Dict[str, Any]:
        """Analyze image optimization"""
        image_analysis = {
            'total_images': 0,
            'optimized_images': 0,
            'total_size': 0,
            'unoptimized_images': []
        }
        
        try:
            site_dir = self.docs_dir.parent / 'site'
            if not site_dir.exists():
                return image_analysis
            
            image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'}
            
            for image_file in site_dir.rglob('*'):
                if image_file.suffix.lower() in image_extensions:
                    size = image_file.stat().st_size
                    image_analysis['total_images'] += 1
                    image_analysis['total_size'] += size
                    
                    # Simple optimization check (size-based)
                    if image_file.suffix.lower() in ['.webp', '.svg'] or size < 100 * 1024:  # < 100KB
                        image_analysis['optimized_images'] += 1
                    else:
                        image_analysis['unoptimized_images'].append({
                            'name': image_file.name,
                            'size': size,
                            'path': str(image_file.relative_to(site_dir))
                        })
            
            # Calculate optimization percentage
            if image_analysis['total_images'] > 0:
                optimization_percent = (image_analysis['optimized_images'] / image_analysis['total_images']) * 100
                self._add_metric('image_optimization_percent', optimization_percent, 'percentage')
        
        except Exception as e:
            self.logger.error(f"Error analyzing image optimization: {e}")
            image_analysis['error'] = str(e)
        
        return image_analysis
    
    def _analyze_compression(self) -> Dict[str, Any]:
        """Analyze compression efficiency"""
        compression_analysis = {
            'gzip_enabled': False,
            'brotli_enabled': False,
            'compression_ratio': None
        }
        
        try:
            if self._check_site_availability():
                # Test compression headers
                response = requests.get(self.site_url)
                
                content_encoding = response.headers.get('content-encoding', '').lower()
                compression_analysis['gzip_enabled'] = 'gzip' in content_encoding
                compression_analysis['brotli_enabled'] = 'br' in content_encoding
                
                # Test a CSS file for compression
                css_url = f"{self.site_url}/assets/stylesheets/main.css"
                try:
                    css_response = requests.get(css_url)
                    if css_response.status_code == 200:
                        original_size = len(css_response.content)
                        # This is a simplified check - real compression analysis would be more complex
                        compression_analysis['sample_file_size'] = original_size
                except:
                    pass
        
        except Exception as e:
            self.logger.error(f"Error analyzing compression: {e}")
            compression_analysis['error'] = str(e)
        
        return compression_analysis
    
    def _analyze_caching(self) -> Dict[str, Any]:
        """Analyze caching headers"""
        caching_analysis = {
            'cache_headers_present': False,
            'max_age': None,
            'etag_present': False
        }
        
        try:
            if self._check_site_availability():
                response = requests.get(self.site_url)
                
                cache_control = response.headers.get('cache-control', '')
                caching_analysis['cache_headers_present'] = bool(cache_control)
                
                if 'max-age=' in cache_control:
                    import re
                    max_age_match = re.search(r'max-age=(\d+)', cache_control)
                    if max_age_match:
                        caching_analysis['max_age'] = int(max_age_match.group(1))
                
                caching_analysis['etag_present'] = 'etag' in response.headers
        
        except Exception as e:
            self.logger.error(f"Error analyzing caching: {e}")
            caching_analysis['error'] = str(e)
        
        return caching_analysis
    
    def _test_search_performance(self) -> Dict[str, Any]:
        """Test search functionality performance"""
        search_performance = {
            'search_available': False,
            'response_times': [],
            'search_results_quality': {}
        }
        
        try:
            driver = self._init_performance_webdriver()
            
            try:
                driver.get(self.site_url)
                
                # Look for search input
                search_selectors = [
                    'input[type="search"]',
                    '.search-input',
                    '[data-md-component="search-query"]',
                    '#search-input'
                ]
                
                search_input = None
                for selector in search_selectors:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        search_input = elements[0]
                        break
                
                if search_input:
                    search_performance['search_available'] = True
                    
                    # Test search performance with different queries
                    test_queries = ['api', 'installation', 'configuration', 'guide']
                    
                    for query in test_queries:
                        start_time = time.time()
                        
                        # Clear and type query
                        search_input.clear()
                        search_input.send_keys(query)
                        
                        # Wait for search results
                        time.sleep(0.5)  # Allow for search to process
                        
                        response_time = time.time() - start_time
                        search_performance['response_times'].append(response_time)
                        
                        # Count results
                        result_selectors = [
                            '.search-result',
                            '[data-md-component="search-result"]',
                            '.search-results li'
                        ]
                        
                        result_count = 0
                        for result_selector in result_selectors:
                            results = driver.find_elements(By.CSS_SELECTOR, result_selector)
                            if results:
                                result_count = len(results)
                                break
                        
                        search_performance['search_results_quality'][query] = {
                            'response_time': response_time,
                            'result_count': result_count
                        }
                    
                    # Calculate average response time
                    if search_performance['response_times']:
                        avg_response_time = statistics.mean(search_performance['response_times'])
                        self._add_metric('search_response_time', avg_response_time, 'seconds')
            
            finally:
                driver.quit()
        
        except Exception as e:
            self.logger.error(f"Error testing search performance: {e}")
            search_performance['error'] = str(e)
        
        return search_performance
    
    def _add_metric(self, metric_name: str, value: float, unit: str, 
                   context: Optional[Dict[str, Any]] = None):
        """Add a performance metric"""
        threshold_passed = True
        recommendation = None
        
        # Check against thresholds
        if metric_name in self.thresholds:
            threshold = self.thresholds[metric_name]
            
            # Determine if threshold is passed (lower is better for most metrics)
            if metric_name in ['lighthouse_performance', 'lighthouse_accessibility', 'lighthouse_best_practices', 'lighthouse_seo', 'image_optimization_percent', 'mobile_friendliness']:
                # Higher is better for these metrics
                threshold_passed = value >= threshold
                if not threshold_passed:
                    recommendation = f"Improve {metric_name} to reach target of {threshold} {unit}"
            else:
                # Lower is better for these metrics
                threshold_passed = value <= threshold
                if not threshold_passed:
                    recommendation = f"Reduce {metric_name} to below {threshold} {unit}"
        
        metric = PerformanceMetric(
            metric_name=metric_name,
            value=value,
            unit=unit,
            timestamp=datetime.now(),
            context=context,
            threshold_passed=threshold_passed,
            recommendation=recommendation
        )
        
        self.metrics.append(metric)
    
    def _generate_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        # Calculate overall scores
        failed_metrics = [m for m in self.metrics if not m.threshold_passed]
        total_metrics = len([m for m in self.metrics if m.metric_name in self.thresholds])
        
        if total_metrics > 0:
            performance_score = ((total_metrics - len(failed_metrics)) / total_metrics) * 100
        else:
            performance_score = 100
        
        # Group metrics by category
        build_metrics = [m for m in self.metrics if 'build' in m.metric_name or 'output' in m.metric_name]
        runtime_metrics = [m for m in self.metrics if 'load' in m.metric_name or 'paint' in m.metric_name]
        ux_metrics = [m for m in self.metrics if 'lighthouse' in m.metric_name or 'mobile' in m.metric_name]
        resource_metrics = [m for m in self.metrics if 'bundle' in m.metric_name or 'image' in m.metric_name]
        search_metrics = [m for m in self.metrics if 'search' in m.metric_name]
        
        report = {
            'summary': {
                'performance_score': round(performance_score, 1),
                'total_metrics': len(self.metrics),
                'failed_thresholds': len(failed_metrics),
                'monitoring_timestamp': datetime.now().isoformat(),
                'build_data': self.monitoring_data.get('build_metrics', {}),
                'recommendations_count': len([m for m in self.metrics if m.recommendation])
            },
            'category_scores': {
                'build_performance': self._calculate_category_score(build_metrics),
                'runtime_performance': self._calculate_category_score(runtime_metrics),
                'user_experience': self._calculate_category_score(ux_metrics),
                'resource_optimization': self._calculate_category_score(resource_metrics),
                'search_performance': self._calculate_category_score(search_metrics)
            },
            'detailed_metrics': [
                {
                    'name': metric.metric_name,
                    'value': metric.value,
                    'unit': metric.unit,
                    'threshold_passed': metric.threshold_passed,
                    'recommendation': metric.recommendation,
                    'timestamp': metric.timestamp.isoformat()
                }
                for metric in sorted(self.metrics, key=lambda x: (not x.threshold_passed, x.metric_name))
            ],
            'monitoring_data': self.monitoring_data,
            'recommendations': self._generate_performance_recommendations(failed_metrics),
            'thresholds': self.thresholds
        }
        
        return report
    
    def _calculate_category_score(self, category_metrics: List[PerformanceMetric]) -> float:
        """Calculate score for a category of metrics"""
        if not category_metrics:
            return 100.0
        
        passed_metrics = len([m for m in category_metrics if m.threshold_passed])
        return (passed_metrics / len(category_metrics)) * 100
    
    def _generate_performance_recommendations(self, failed_metrics: List[PerformanceMetric]) -> List[str]:
        """Generate actionable performance recommendations"""
        recommendations = []
        
        # Add specific recommendations based on failed metrics
        for metric in failed_metrics:
            if metric.recommendation:
                recommendations.append(metric.recommendation)
        
        # Add general recommendations
        if any('build_time' in m.metric_name for m in failed_metrics):
            recommendations.append("🚀 Optimize MkDocs build by reducing plugin overhead and file processing")
        
        if any('load_time' in m.metric_name for m in failed_metrics):
            recommendations.append("⚡ Improve page load times by optimizing CSS, JavaScript, and images")
        
        if any('lighthouse' in m.metric_name for m in failed_metrics):
            recommendations.append("📊 Run detailed Lighthouse audit to identify specific performance issues")
        
        if any('bundle' in m.metric_name for m in failed_metrics):
            recommendations.append("📦 Reduce bundle sizes by eliminating unused CSS/JavaScript")
        
        if any('search' in m.metric_name for m in failed_metrics):
            recommendations.append("🔍 Optimize search functionality for better response times")
        
        # General recommendations
        recommendations.extend([
            "📈 Set up continuous performance monitoring in CI/CD pipeline",
            "🎯 Establish performance budgets for key metrics",
            "📱 Prioritize mobile performance optimization",
            "🗜️ Implement compression and caching strategies",
            "🖼️ Optimize images with modern formats (WebP, AVIF)",
            "⚡ Consider implementing a CDN for static assets"
        ])
        
        return list(set(recommendations))  # Remove duplicates

class ResourceMonitor:
    """Monitor system resources during build"""
    
    def __init__(self):
        self.memory_usage = []
        self.cpu_usage = []
        self.monitoring = False
    
    def monitor(self, interval: float = 1.0, duration: float = 60.0):
        """Monitor system resources"""
        self.monitoring = True
        start_time = time.time()
        
        while self.monitoring and (time.time() - start_time) < duration:
            # Get memory usage
            memory = psutil.virtual_memory()
            self.memory_usage.append(memory.percent)
            
            # Get CPU usage
            cpu = psutil.cpu_percent(interval=0.1)
            self.cpu_usage.append(cpu)
            
            time.sleep(interval)
    
    def stop(self):
        """Stop monitoring"""
        self.monitoring = False

def main():
    """Main execution function"""
    monitor = PerformanceMonitor()
    report = monitor.monitor_performance()
    
    # Save report
    report_path = Path("tests/docs-qa/performance_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    # Print summary
    print(f"\n⚡ Performance Monitoring Complete!")
    print(f"🎯 Performance Score: {report['summary']['performance_score']}/100")
    print(f"📊 Total Metrics: {report['summary']['total_metrics']}")
    print(f"❌ Failed Thresholds: {report['summary']['failed_thresholds']}")
    
    # Category scores
    print(f"\n📈 Category Scores:")
    for category, score in report['category_scores'].items():
        emoji = '✅' if score >= 90 else '⚠️' if score >= 70 else '❌'
        print(f"   {category.replace('_', ' ').title()}: {emoji} {score:.1f}%")
    
    # Build performance
    build_data = report['summary']['build_data']
    if 'build_time' in build_data:
        print(f"\n🏗️ Build Performance:")
        print(f"   Build Time: {build_data['build_time']:.2f}s")
        print(f"   Files Generated: {build_data.get('file_count', 'N/A')}")
        print(f"   Total Size: {build_data.get('total_size', 0) / (1024 * 1024):.1f} MB")
    
    print(f"\n📄 Report saved to: {report_path}")
    
    # Show critical performance issues
    critical_issues = [m for m in report['detailed_metrics'] if not m['threshold_passed']]
    if critical_issues:
        print(f"\n🚨 Performance issues found:")
        for issue in critical_issues[:5]:
            print(f"  - {issue['name']}: {issue['value']} {issue['unit']} (threshold exceeded)")

if __name__ == "__main__":
    main()