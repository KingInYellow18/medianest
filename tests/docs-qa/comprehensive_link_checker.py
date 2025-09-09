#!/usr/bin/env python3
"""
Comprehensive Link Checker for MediaNest Documentation
Validates all internal and external links across markdown files.
"""

import os
import re
import requests
import asyncio
import aiohttp
from pathlib import Path
from urllib.parse import urljoin, urlparse
from dataclasses import dataclass
from typing import List, Dict, Set, Optional, Tuple
import json
import time
from concurrent.futures import ThreadPoolExecutor
import logging

@dataclass
class LinkResult:
    """Result of link validation check"""
    url: str
    source_file: str
    line_number: int
    status_code: Optional[int] = None
    error: Optional[str] = None
    is_valid: bool = False
    response_time: float = 0.0
    redirect_chain: List[str] = None

class ComprehensiveLinkChecker:
    """Advanced link checker with comprehensive validation capabilities"""
    
    def __init__(self, docs_dir: str = "docs", base_url: str = "https://docs.medianest.com"):
        self.docs_dir = Path(docs_dir)
        self.base_url = base_url
        self.results: List[LinkResult] = []
        self.external_cache: Dict[str, LinkResult] = {}
        self.session_timeout = aiohttp.ClientTimeout(total=30)
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Link patterns
        self.link_patterns = [
            # Markdown links: [text](url)
            re.compile(r'\[([^\]]*)\]\(([^)]+)\)'),
            # Reference links: [text][ref]
            re.compile(r'\[([^\]]*)\]\[([^\]]+)\]'),
            # Direct URLs
            re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+'),
            # Image links: ![alt](url)
            re.compile(r'!\[([^\]]*)\]\(([^)]+)\)'),
            # HTML links: <a href="url">
            re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>'),
            # HTML images: <img src="url">
            re.compile(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>'),
        ]
        
        # File extensions to check
        self.markdown_extensions = {'.md', '.markdown', '.mdx'}
        
    async def check_all_links(self) -> Dict[str, any]:
        """Check all links in documentation"""
        self.logger.info(f"Starting comprehensive link check in {self.docs_dir}")
        
        # Find all markdown files
        markdown_files = self._find_markdown_files()
        self.logger.info(f"Found {len(markdown_files)} markdown files")
        
        # Extract all links
        all_links = {}
        for file_path in markdown_files:
            links = self._extract_links_from_file(file_path)
            if links:
                all_links[str(file_path)] = links
        
        self.logger.info(f"Extracted {sum(len(links) for links in all_links.values())} total links")
        
        # Validate links
        await self._validate_links(all_links)
        
        # Generate comprehensive report
        report = self._generate_report()
        
        return report
    
    def _find_markdown_files(self) -> List[Path]:
        """Find all markdown files in documentation directory"""
        markdown_files = []
        
        for root, dirs, files in os.walk(self.docs_dir):
            # Skip hidden directories and __pycache__
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
            
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in self.markdown_extensions:
                    markdown_files.append(file_path)
        
        return sorted(markdown_files)
    
    def _extract_links_from_file(self, file_path: Path) -> List[Tuple[str, int, str]]:
        """Extract all links from a markdown file"""
        links = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                
                for line_num, line in enumerate(lines, 1):
                    # Check each pattern
                    for pattern in self.link_patterns:
                        matches = pattern.finditer(line)
                        for match in matches:
                            if pattern.groups >= 2:
                                # Markdown/HTML links with separate text and URL
                                url = match.group(2)
                            else:
                                # Direct URLs
                                url = match.group(0)
                            
                            # Clean up the URL
                            url = url.strip()
                            if url and not url.startswith('#'):  # Skip anchors
                                links.append((url, line_num, line.strip()))
                
        except Exception as e:
            self.logger.error(f"Error reading file {file_path}: {e}")
        
        return links
    
    async def _validate_links(self, all_links: Dict[str, List[Tuple[str, int, str]]]):
        """Validate all extracted links"""
        # Separate internal and external links
        internal_links = []
        external_links = []
        
        for file_path, links in all_links.items():
            for url, line_num, line_text in links:
                if self._is_internal_link(url):
                    internal_links.append((file_path, url, line_num, line_text))
                else:
                    external_links.append((file_path, url, line_num, line_text))
        
        self.logger.info(f"Validating {len(internal_links)} internal links")
        await self._validate_internal_links(internal_links)
        
        self.logger.info(f"Validating {len(external_links)} external links")
        await self._validate_external_links(external_links)
    
    def _is_internal_link(self, url: str) -> bool:
        """Check if a link is internal"""
        if url.startswith(('http://', 'https://')):
            parsed = urlparse(url)
            return 'medianest' in parsed.netloc or 'localhost' in parsed.netloc
        return not url.startswith(('mailto:', 'tel:', 'ftp://'))
    
    async def _validate_internal_links(self, internal_links: List[Tuple[str, str, int, str]]):
        """Validate internal links (file existence, anchors)"""
        for file_path, url, line_num, line_text in internal_links:
            result = LinkResult(
                url=url,
                source_file=file_path,
                line_number=line_num
            )
            
            try:
                # Handle relative paths
                if url.startswith('/'):
                    # Absolute path from docs root
                    target_path = self.docs_dir / url.lstrip('/')
                elif url.startswith('./') or not url.startswith(('http', 'mailto', 'tel')):
                    # Relative path
                    source_dir = Path(file_path).parent
                    target_path = source_dir / url
                else:
                    # External URL that looks internal
                    await self._check_external_url(result)
                    self.results.append(result)
                    continue
                
                # Remove anchor from path
                if '#' in str(target_path):
                    path_part, anchor = str(target_path).split('#', 1)
                    target_path = Path(path_part)
                else:
                    anchor = None
                
                # Check if file exists
                if target_path.exists():
                    result.is_valid = True
                    result.status_code = 200
                    
                    # If there's an anchor, check if it exists in the file
                    if anchor and target_path.suffix.lower() in self.markdown_extensions:
                        if not self._check_anchor_exists(target_path, anchor):
                            result.is_valid = False
                            result.error = f"Anchor '#{anchor}' not found in {target_path}"
                else:
                    result.is_valid = False
                    result.error = f"File not found: {target_path}"
                    result.status_code = 404
                    
            except Exception as e:
                result.is_valid = False
                result.error = str(e)
            
            self.results.append(result)
    
    def _check_anchor_exists(self, file_path: Path, anchor: str) -> bool:
        """Check if an anchor exists in a markdown file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Check for heading anchors
                heading_pattern = re.compile(r'^#+\s+(.+)$', re.MULTILINE)
                headings = heading_pattern.findall(content)
                
                for heading in headings:
                    # Convert heading to anchor format
                    heading_anchor = re.sub(r'[^\w\s-]', '', heading).strip().lower().replace(' ', '-')
                    if heading_anchor == anchor.lower():
                        return True
                
                # Check for explicit anchor tags
                anchor_pattern = re.compile(rf'<a[^>]+(?:name|id)=["\']({re.escape(anchor)})["\'][^>]*>')
                if anchor_pattern.search(content):
                    return True
                    
        except Exception:
            pass
        
        return False
    
    async def _validate_external_links(self, external_links: List[Tuple[str, str, int, str]]):
        """Validate external links with rate limiting and caching"""
        # Group by domain for rate limiting
        domains = {}
        for file_path, url, line_num, line_text in external_links:
            parsed = urlparse(url)
            domain = parsed.netloc
            if domain not in domains:
                domains[domain] = []
            domains[domain].append((file_path, url, line_num, line_text))
        
        # Process domains concurrently with limits
        semaphore = asyncio.Semaphore(10)  # Limit concurrent requests
        
        async with aiohttp.ClientSession(timeout=self.session_timeout) as session:
            tasks = []
            for domain, domain_links in domains.items():
                task = self._validate_domain_links(session, semaphore, domain_links)
                tasks.append(task)
            
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _validate_domain_links(self, session: aiohttp.ClientSession, 
                                   semaphore: asyncio.Semaphore, 
                                   domain_links: List[Tuple[str, str, int, str]]):
        """Validate links for a specific domain with rate limiting"""
        for file_path, url, line_num, line_text in domain_links:
            async with semaphore:
                # Check cache first
                if url in self.external_cache:
                    cached_result = self.external_cache[url]
                    result = LinkResult(
                        url=url,
                        source_file=file_path,
                        line_number=line_num,
                        status_code=cached_result.status_code,
                        error=cached_result.error,
                        is_valid=cached_result.is_valid,
                        response_time=cached_result.response_time
                    )
                else:
                    result = LinkResult(url=url, source_file=file_path, line_number=line_num)
                    await self._check_external_url_with_session(session, result)
                    self.external_cache[url] = result
                
                self.results.append(result)
                
                # Small delay to be respectful
                await asyncio.sleep(0.1)
    
    async def _check_external_url_with_session(self, session: aiohttp.ClientSession, result: LinkResult):
        """Check external URL with aiohttp session"""
        start_time = time.time()
        
        try:
            async with session.head(result.url, allow_redirects=True) as response:
                result.status_code = response.status
                result.response_time = time.time() - start_time
                result.is_valid = 200 <= response.status < 400
                
                if not result.is_valid:
                    result.error = f"HTTP {response.status}"
                    
        except asyncio.TimeoutError:
            result.error = "Timeout"
            result.response_time = time.time() - start_time
        except Exception as e:
            result.error = str(e)
            result.response_time = time.time() - start_time
    
    async def _check_external_url(self, result: LinkResult):
        """Fallback method for checking external URLs"""
        start_time = time.time()
        
        try:
            response = requests.head(result.url, timeout=10, allow_redirects=True)
            result.status_code = response.status_code
            result.response_time = time.time() - start_time
            result.is_valid = 200 <= response.status_code < 400
            
            if not result.is_valid:
                result.error = f"HTTP {response.status_code}"
                
        except requests.RequestException as e:
            result.error = str(e)
            result.response_time = time.time() - start_time
    
    def _generate_report(self) -> Dict[str, any]:
        """Generate comprehensive link validation report"""
        total_links = len(self.results)
        valid_links = sum(1 for r in self.results if r.is_valid)
        invalid_links = total_links - valid_links
        
        # Group by error type
        errors_by_type = {}
        broken_links = []
        slow_links = []
        
        for result in self.results:
            if not result.is_valid:
                error_type = result.error or "Unknown error"
                if error_type not in errors_by_type:
                    errors_by_type[error_type] = []
                errors_by_type[error_type].append(result)
                broken_links.append(result)
            
            # Flag slow links (>5 seconds)
            if result.response_time > 5.0:
                slow_links.append(result)
        
        # Calculate success rate
        success_rate = (valid_links / total_links * 100) if total_links > 0 else 100
        
        report = {
            'summary': {
                'total_links': total_links,
                'valid_links': valid_links,
                'invalid_links': invalid_links,
                'success_rate': round(success_rate, 2),
                'average_response_time': round(
                    sum(r.response_time for r in self.results if r.response_time > 0) / 
                    len([r for r in self.results if r.response_time > 0]), 2
                ) if any(r.response_time > 0 for r in self.results) else 0
            },
            'broken_links': [
                {
                    'url': r.url,
                    'source_file': r.source_file,
                    'line_number': r.line_number,
                    'error': r.error,
                    'status_code': r.status_code
                }
                for r in broken_links
            ],
            'slow_links': [
                {
                    'url': r.url,
                    'source_file': r.source_file,
                    'response_time': round(r.response_time, 2)
                }
                for r in slow_links
            ],
            'errors_by_type': {
                error_type: len(results) 
                for error_type, results in errors_by_type.items()
            },
            'recommendations': self._generate_recommendations(errors_by_type, slow_links)
        }
        
        return report
    
    def _generate_recommendations(self, errors_by_type: Dict[str, List[LinkResult]], 
                                slow_links: List[LinkResult]) -> List[str]:
        """Generate actionable recommendations based on link check results"""
        recommendations = []
        
        if '404' in str(errors_by_type):
            recommendations.append("Fix broken internal links by updating file paths or creating missing files")
        
        if 'Timeout' in str(errors_by_type):
            recommendations.append("Review external links that timeout - they may be unreliable")
        
        if slow_links:
            recommendations.append(f"Consider replacing {len(slow_links)} slow-loading external links with more reliable alternatives")
        
        if any('certificate' in str(error).lower() for error in errors_by_type.keys()):
            recommendations.append("Some external sites have SSL certificate issues - verify these links manually")
        
        recommendations.append("Run link checking regularly in CI/CD pipeline to catch issues early")
        
        return recommendations

async def main():
    """Main execution function"""
    checker = ComprehensiveLinkChecker()
    report = await checker.check_all_links()
    
    # Save report
    report_path = Path("tests/docs-qa/link_check_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print(f"\n🔗 Link Check Complete!")
    print(f"✅ Valid links: {report['summary']['valid_links']}")
    print(f"❌ Broken links: {report['summary']['invalid_links']}")
    print(f"📊 Success rate: {report['summary']['success_rate']}%")
    print(f"📄 Report saved to: {report_path}")
    
    if report['broken_links']:
        print(f"\n🚨 Found {len(report['broken_links'])} broken links:")
        for broken in report['broken_links'][:5]:  # Show first 5
            print(f"  - {broken['url']} in {broken['source_file']}:{broken['line_number']}")
        if len(report['broken_links']) > 5:
            print(f"  ... and {len(report['broken_links']) - 5} more")

if __name__ == "__main__":
    asyncio.run(main())