#!/usr/bin/env python3
"""
Performance audit script for MediaNest documentation site.
Analyzes build output for performance optimization opportunities.
"""

import os
import sys
import json
import gzip
from pathlib import Path
import argparse
import logging
from collections import defaultdict
import mimetypes

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class PerformanceAuditor:
    def __init__(self, site_dir):
        self.site_dir = Path(site_dir)
        self.issues = []
        self.metrics = {}
        self.recommendations = []
        
        # Performance thresholds
        self.thresholds = {
            'max_file_size_mb': 5,
            'max_image_size_mb': 1,
            'max_css_size_kb': 200,
            'max_js_size_kb': 500,
            'max_html_size_kb': 100,
            'min_compression_ratio': 0.7
        }
    
    def audit_site(self):
        """Run comprehensive performance audit."""
        logger.info(f"Starting performance audit of {self.site_dir}")
        
        self._analyze_file_sizes()
        self._analyze_images()
        self._analyze_css_js()
        self._analyze_html_files()
        self._check_compression()
        self._analyze_dependencies()
        self._generate_recommendations()
        
        return len(self.issues) == 0
    
    def _analyze_file_sizes(self):
        """Analyze overall file size distribution."""
        logger.info("Analyzing file sizes...")
        
        file_sizes = {}
        total_size = 0
        file_count = 0
        
        for file_path in self.site_dir.rglob('*'):
            if file_path.is_file():
                size = file_path.stat().st_size
                file_sizes[str(file_path.relative_to(self.site_dir))] = size
                total_size += size
                file_count += 1
                
                # Check individual file sizes
                size_mb = size / (1024 * 1024)
                if size_mb > self.thresholds['max_file_size_mb']:
                    self.issues.append({
                        'type': 'large_file',
                        'file': str(file_path.relative_to(self.site_dir)),
                        'size_mb': round(size_mb, 2),
                        'message': f'Large file: {size_mb:.1f}MB (limit: {self.thresholds["max_file_size_mb"]}MB)'
                    })
        
        self.metrics['total_size_mb'] = round(total_size / (1024 * 1024), 2)
        self.metrics['file_count'] = file_count
        self.metrics['average_file_size_kb'] = round(total_size / file_count / 1024, 2) if file_count > 0 else 0
        
        logger.info(f"Total site size: {self.metrics['total_size_mb']}MB")
        logger.info(f"Total files: {file_count}")
    
    def _analyze_images(self):
        """Analyze image files for optimization opportunities."""
        logger.info("Analyzing images...")
        
        image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'}
        image_files = []
        total_image_size = 0
        
        for ext in image_extensions:
            for img_file in self.site_dir.rglob(f'*{ext}'):
                size = img_file.stat().st_size
                image_files.append({
                    'path': str(img_file.relative_to(self.site_dir)),
                    'size': size,
                    'extension': ext
                })
                total_image_size += size
                
                # Check individual image sizes
                size_mb = size / (1024 * 1024)
                if size_mb > self.thresholds['max_image_size_mb']:
                    self.issues.append({
                        'type': 'large_image',
                        'file': str(img_file.relative_to(self.site_dir)),
                        'size_mb': round(size_mb, 2),
                        'message': f'Large image: {size_mb:.1f}MB (consider optimizing)'
                    })
                
                # Recommend modern formats for large PNG/JPG files
                if ext in {'.png', '.jpg', '.jpeg'} and size > 100 * 1024:  # > 100KB
                    self.recommendations.append({
                        'type': 'image_format',
                        'file': str(img_file.relative_to(self.site_dir)),
                        'current_format': ext,
                        'recommended_format': 'webp',
                        'message': f'Consider converting {ext} to WebP for better compression'
                    })
        
        self.metrics['image_count'] = len(image_files)
        self.metrics['total_image_size_mb'] = round(total_image_size / (1024 * 1024), 2)
        
        # Find missing alt attributes in HTML files
        self._check_image_alt_attributes()
    
    def _check_image_alt_attributes(self):
        """Check for missing alt attributes in images."""
        import re
        
        for html_file in self.site_dir.rglob('*.html'):
            try:
                with open(html_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Find img tags without alt attributes
                img_tags = re.findall(r'<img[^>]*>', content, re.IGNORECASE)
                for img_tag in img_tags:
                    if 'alt=' not in img_tag:
                        self.issues.append({
                            'type': 'missing_alt',
                            'file': str(html_file.relative_to(self.site_dir)),
                            'message': 'Image missing alt attribute (accessibility issue)'
                        })
            except Exception:
                pass
    
    def _analyze_css_js(self):
        """Analyze CSS and JavaScript files."""
        logger.info("Analyzing CSS and JavaScript files...")
        
        # CSS files
        css_files = list(self.site_dir.rglob('*.css'))
        total_css_size = 0
        
        for css_file in css_files:
            size = css_file.stat().st_size
            total_css_size += size
            
            size_kb = size / 1024
            if size_kb > self.thresholds['max_css_size_kb']:
                self.issues.append({
                    'type': 'large_css',
                    'file': str(css_file.relative_to(self.site_dir)),
                    'size_kb': round(size_kb, 1),
                    'message': f'Large CSS file: {size_kb:.1f}KB (consider minification)'
                })
            
            # Check for unminified CSS
            if not self._is_minified_css(css_file):
                self.recommendations.append({
                    'type': 'css_minification',
                    'file': str(css_file.relative_to(self.site_dir)),
                    'message': 'CSS file appears unminified - consider minification'
                })
        
        # JavaScript files
        js_files = list(self.site_dir.rglob('*.js'))
        total_js_size = 0
        
        for js_file in js_files:
            size = js_file.stat().st_size
            total_js_size += size
            
            size_kb = size / 1024
            if size_kb > self.thresholds['max_js_size_kb']:
                self.issues.append({
                    'type': 'large_js',
                    'file': str(js_file.relative_to(self.site_dir)),
                    'size_kb': round(size_kb, 1),
                    'message': f'Large JavaScript file: {size_kb:.1f}KB (consider minification/splitting)'
                })
            
            # Check for unminified JS
            if not self._is_minified_js(js_file):
                self.recommendations.append({
                    'type': 'js_minification',
                    'file': str(js_file.relative_to(self.site_dir)),
                    'message': 'JavaScript file appears unminified - consider minification'
                })
        
        self.metrics['css_count'] = len(css_files)
        self.metrics['js_count'] = len(js_files)
        self.metrics['total_css_size_kb'] = round(total_css_size / 1024, 2)
        self.metrics['total_js_size_kb'] = round(total_js_size / 1024, 2)
    
    def _is_minified_css(self, css_file):
        """Check if CSS file appears to be minified."""
        try:
            with open(css_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Simple heuristics for minification
            lines = content.split('\n')
            if len(lines) <= 5:  # Very few lines
                return True
            
            # Check for lack of indentation and long lines
            long_lines = [line for line in lines if len(line) > 100]
            return len(long_lines) / len(lines) > 0.3
        except Exception:
            return False
    
    def _is_minified_js(self, js_file):
        """Check if JavaScript file appears to be minified."""
        try:
            with open(js_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Simple heuristics for minification
            lines = content.split('\n')
            if len(lines) <= 5:  # Very few lines
                return True
            
            # Check for lack of whitespace and long lines
            long_lines = [line for line in lines if len(line) > 150]
            return len(long_lines) / len(lines) > 0.5
        except Exception:
            return False
    
    def _analyze_html_files(self):
        """Analyze HTML files for performance issues."""
        logger.info("Analyzing HTML files...")
        
        html_files = list(self.site_dir.rglob('*.html'))
        total_html_size = 0
        
        for html_file in html_files:
            size = html_file.stat().st_size
            total_html_size += size
            
            size_kb = size / 1024
            if size_kb > self.thresholds['max_html_size_kb']:
                self.issues.append({
                    'type': 'large_html',
                    'file': str(html_file.relative_to(self.site_dir)),
                    'size_kb': round(size_kb, 1),
                    'message': f'Large HTML file: {size_kb:.1f}KB (consider pagination)'
                })
            
            # Analyze HTML content
            self._analyze_html_content(html_file)
        
        self.metrics['html_count'] = len(html_files)
        self.metrics['total_html_size_kb'] = round(total_html_size / 1024, 2)
    
    def _analyze_html_content(self, html_file):
        """Analyze individual HTML file content."""
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for inline styles and scripts
            import re
            
            inline_styles = len(re.findall(r'<style[^>]*>.*?</style>', content, re.DOTALL))
            inline_scripts = len(re.findall(r'<script[^>]*>.*?</script>', content, re.DOTALL))
            
            if inline_styles > 0:
                self.recommendations.append({
                    'type': 'inline_styles',
                    'file': str(html_file.relative_to(self.site_dir)),
                    'count': inline_styles,
                    'message': f'Found {inline_styles} inline style blocks - consider external CSS'
                })
            
            if inline_scripts > 2:  # Allow some inline scripts
                self.recommendations.append({
                    'type': 'inline_scripts',
                    'file': str(html_file.relative_to(self.site_dir)),
                    'count': inline_scripts,
                    'message': f'Found {inline_scripts} inline script blocks - consider external JS'
                })
            
            # Check for missing meta tags
            if '<meta name="description"' not in content:
                self.issues.append({
                    'type': 'missing_meta_description',
                    'file': str(html_file.relative_to(self.site_dir)),
                    'message': 'Missing meta description (SEO issue)'
                })
            
            if '<meta name="viewport"' not in content:
                self.issues.append({
                    'type': 'missing_viewport',
                    'file': str(html_file.relative_to(self.site_dir)),
                    'message': 'Missing viewport meta tag (mobile issue)'
                })
        
        except Exception:
            pass
    
    def _check_compression(self):
        """Check if files can benefit from compression."""
        logger.info("Analyzing compression opportunities...")
        
        compressible_extensions = {'.html', '.css', '.js', '.json', '.xml', '.svg', '.txt'}
        
        for file_path in self.site_dir.rglob('*'):
            if file_path.is_file() and file_path.suffix in compressible_extensions:
                try:
                    original_size = file_path.stat().st_size
                    
                    # Skip very small files
                    if original_size < 1024:  # < 1KB
                        continue
                    
                    # Test gzip compression
                    with open(file_path, 'rb') as f:
                        original_data = f.read()
                    
                    compressed_data = gzip.compress(original_data)
                    compressed_size = len(compressed_data)
                    
                    compression_ratio = compressed_size / original_size
                    
                    if compression_ratio < self.thresholds['min_compression_ratio']:
                        savings_kb = (original_size - compressed_size) / 1024
                        self.recommendations.append({
                            'type': 'compression',
                            'file': str(file_path.relative_to(self.site_dir)),
                            'original_size_kb': round(original_size / 1024, 1),
                            'compressed_size_kb': round(compressed_size / 1024, 1),
                            'savings_kb': round(savings_kb, 1),
                            'compression_ratio': round(compression_ratio, 2),
                            'message': f'Good compression candidate: {savings_kb:.1f}KB savings possible'
                        })
                
                except Exception:
                    pass
    
    def _analyze_dependencies(self):
        """Analyze external dependencies and CDN usage."""
        logger.info("Analyzing dependencies...")
        
        external_resources = defaultdict(list)
        
        for html_file in self.site_dir.rglob('*.html'):
            try:
                with open(html_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                import re
                
                # Find external CSS links
                css_links = re.findall(r'<link[^>]*href=["\']([^"\']*)["\'][^>]*>', content)
                for link in css_links:
                    if link.startswith(('http://', 'https://')):
                        external_resources['css'].append(link)
                
                # Find external JavaScript
                js_links = re.findall(r'<script[^>]*src=["\']([^"\']*)["\'][^>]*>', content)
                for link in js_links:
                    if link.startswith(('http://', 'https://')):
                        external_resources['js'].append(link)
                
                # Find external images
                img_links = re.findall(r'<img[^>]*src=["\']([^"\']*)["\'][^>]*>', content)
                for link in img_links:
                    if link.startswith(('http://', 'https://')):
                        external_resources['images'].append(link)
            
            except Exception:
                pass
        
        self.metrics['external_css'] = len(set(external_resources['css']))
        self.metrics['external_js'] = len(set(external_resources['js']))
        self.metrics['external_images'] = len(set(external_resources['images']))
        
        # Check for too many external dependencies
        total_external = sum(len(set(resources)) for resources in external_resources.values())
        if total_external > 10:
            self.issues.append({
                'type': 'too_many_external_deps',
                'count': total_external,
                'message': f'Many external dependencies ({total_external}) - consider bundling'
            })
    
    def _generate_recommendations(self):
        """Generate performance recommendations based on analysis."""
        logger.info("Generating performance recommendations...")
        
        # Bundle size recommendations
        if self.metrics.get('total_size_mb', 0) > 10:
            self.recommendations.append({
                'type': 'bundle_size',
                'message': f'Large bundle size ({self.metrics["total_size_mb"]}MB) - consider code splitting'
            })
        
        # Image optimization recommendations
        if self.metrics.get('total_image_size_mb', 0) > 5:
            self.recommendations.append({
                'type': 'image_optimization',
                'message': 'Large image payload - consider lazy loading and optimization'
            })
        
        # CSS/JS optimization
        if self.metrics.get('total_css_size_kb', 0) > 500:
            self.recommendations.append({
                'type': 'css_optimization',
                'message': 'Large CSS payload - consider critical CSS and lazy loading'
            })
        
        if self.metrics.get('total_js_size_kb', 0) > 1000:
            self.recommendations.append({
                'type': 'js_optimization',
                'message': 'Large JavaScript payload - consider code splitting and lazy loading'
            })
    
    def generate_report(self):
        """Generate performance audit report."""
        report = "# Performance Audit Report\n\n"
        
        # Overview
        report += "## Overview\n\n"
        report += f"- Total site size: {self.metrics.get('total_size_mb', 0)}MB\n"
        report += f"- Total files: {self.metrics.get('file_count', 0)}\n"
        report += f"- HTML files: {self.metrics.get('html_count', 0)}\n"
        report += f"- CSS files: {self.metrics.get('css_count', 0)} ({self.metrics.get('total_css_size_kb', 0)}KB)\n"
        report += f"- JS files: {self.metrics.get('js_count', 0)} ({self.metrics.get('total_js_size_kb', 0)}KB)\n"
        report += f"- Images: {self.metrics.get('image_count', 0)} ({self.metrics.get('total_image_size_mb', 0)}MB)\n"
        report += f"- External dependencies: CSS({self.metrics.get('external_css', 0)}) JS({self.metrics.get('external_js', 0)}) Images({self.metrics.get('external_images', 0)})\n\n"
        
        # Issues
        if self.issues:
            report += f"## Issues ({len(self.issues)})\n\n"
            
            issue_types = defaultdict(list)
            for issue in self.issues:
                issue_types[issue['type']].append(issue)
            
            for issue_type, issues in issue_types.items():
                report += f"### {issue_type.replace('_', ' ').title()}\n\n"
                for issue in issues:
                    report += f"- {issue['message']}\n"
                report += "\n"
        else:
            report += "## Issues\n\n✅ No performance issues found!\n\n"
        
        # Recommendations
        if self.recommendations:
            report += f"## Recommendations ({len(self.recommendations)})\n\n"
            
            rec_types = defaultdict(list)
            for rec in self.recommendations:
                rec_types[rec['type']].append(rec)
            
            for rec_type, recs in rec_types.items():
                report += f"### {rec_type.replace('_', ' ').title()}\n\n"
                for rec in recs:
                    report += f"- {rec['message']}\n"
                report += "\n"
        else:
            report += "## Recommendations\n\n✅ No specific recommendations at this time.\n\n"
        
        return report
    
    def save_report(self, filename='performance-audit-report.json'):
        """Save detailed report as JSON."""
        report_data = {
            'metrics': self.metrics,
            'issues': self.issues,
            'recommendations': self.recommendations,
            'status': 'success' if len(self.issues) == 0 else 'warning'
        }
        
        with open(filename, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        logger.info(f"Detailed report saved to {filename}")

def main():
    parser = argparse.ArgumentParser(description='Performance audit for documentation site')
    parser.add_argument('site_dir', nargs='?', default='site', help='Path to built site directory')
    parser.add_argument('--report', help='Save detailed report to JSON file', default='performance-audit-report.json')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    if not os.path.exists(args.site_dir):
        logger.error(f"Site directory not found: {args.site_dir}")
        return 1
    
    auditor = PerformanceAuditor(args.site_dir)
    
    # Run audit
    auditor.audit_site()
    
    # Print report
    print(auditor.generate_report())
    
    # Save detailed report
    auditor.save_report(args.report)
    
    # Return exit code based on issues
    return 0 if len(auditor.issues) == 0 else 1

if __name__ == '__main__':
    sys.exit(main())