#!/usr/bin/env python3
"""
Accessibility Tester for MediaNest Documentation
Tests WCAG compliance, screen reader compatibility, and inclusive design.
"""

import os
import re
import json
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Set, Optional, Tuple, Any
import logging
from bs4 import BeautifulSoup, Comment
import requests
from urllib.parse import urljoin, urlparse
import subprocess
import time

@dataclass
class AccessibilityIssue:
    """Represents an accessibility issue found in documentation"""
    file_path: str
    line_number: int
    issue_type: str
    wcag_level: str  # 'A', 'AA', 'AAA'
    severity: str   # 'critical', 'major', 'minor'
    message: str
    recommendation: str
    element: Optional[str] = None
    context: Optional[str] = None

class AccessibilityTester:
    """Comprehensive accessibility testing for documentation"""
    
    def __init__(self, docs_dir: str = "docs", site_dir: str = "site"):
        self.docs_dir = Path(docs_dir)
        self.site_dir = Path(site_dir)
        self.issues: List[AccessibilityIssue] = []
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # WCAG 2.1 Guidelines mapping
        self.wcag_guidelines = {
            'alt_text': {'level': 'A', 'principle': 'Perceivable'},
            'heading_hierarchy': {'level': 'AA', 'principle': 'Perceivable'},
            'color_contrast': {'level': 'AA', 'principle': 'Perceivable'},
            'keyboard_navigation': {'level': 'A', 'principle': 'Operable'},
            'focus_management': {'level': 'AA', 'principle': 'Operable'},
            'link_purpose': {'level': 'AA', 'principle': 'Understandable'},
            'page_titles': {'level': 'A', 'principle': 'Understandable'},
            'language_identification': {'level': 'A', 'principle': 'Understandable'},
            'consistent_navigation': {'level': 'AA', 'principle': 'Understandable'},
            'error_identification': {'level': 'A', 'principle': 'Understandable'},
            'markup_validity': {'level': 'A', 'principle': 'Robust'},
            'name_role_value': {'level': 'A', 'principle': 'Robust'}
        }
        
        # Accessibility patterns
        self.patterns = {
            'image_without_alt': re.compile(r'!\[[^\]]*\]\([^)]+\)'),
            'heading': re.compile(r'^(#{1,6})\s+(.+)$'),
            'link': re.compile(r'\[([^\]]*)\]\(([^)]+)\)'),
            'html_tag': re.compile(r'<([^/>][^>]*)>'),
            'color_reference': re.compile(r'(red|green|blue|yellow|click here|here|this|that)', re.IGNORECASE),
            'abbreviation': re.compile(r'\b[A-Z]{2,}\b'),
            'table_header': re.compile(r'^\|(.+)\|$')
        }
    
    def test_accessibility(self) -> Dict[str, Any]:
        """Run comprehensive accessibility tests"""
        self.logger.info("Starting comprehensive accessibility testing")
        
        # Test markdown source files
        self._test_markdown_accessibility()
        
        # Test generated HTML if available
        if self.site_dir.exists():
            self._test_html_accessibility()
        else:
            self.logger.warning("Generated site not found, skipping HTML accessibility tests")
        
        # Generate comprehensive report
        report = self._generate_accessibility_report()
        
        return report
    
    def _test_markdown_accessibility(self):
        """Test accessibility of markdown source files"""
        markdown_files = self._find_markdown_files()
        self.logger.info(f"Testing {len(markdown_files)} markdown files for accessibility")
        
        for file_path in markdown_files:
            self._test_file_accessibility(file_path)
    
    def _find_markdown_files(self) -> List[Path]:
        """Find all markdown files"""
        markdown_files = []
        extensions = {'.md', '.markdown', '.mdx'}
        
        for root, dirs, files in os.walk(self.docs_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in extensions:
                    markdown_files.append(file_path)
        
        return sorted(markdown_files)
    
    def _test_file_accessibility(self, file_path: Path):
        """Test accessibility of a single markdown file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Test various accessibility aspects
            self._test_images_accessibility(file_path, lines)
            self._test_headings_accessibility(file_path, lines)
            self._test_links_accessibility(file_path, lines)
            self._test_tables_accessibility(file_path, lines)
            self._test_language_accessibility(file_path, content)
            self._test_structure_accessibility(file_path, content, lines)
            
        except Exception as e:
            self._add_issue(
                file_path, 1, 'file_error', 'A', 'critical',
                f"Error reading file: {e}",
                "Ensure file is readable and properly encoded"
            )
    
    def _test_images_accessibility(self, file_path: Path, lines: List[str]):
        """Test image accessibility (alt text, etc.)"""
        for line_num, line in enumerate(lines, 1):
            # Find image references
            image_matches = re.finditer(r'!\[([^\]]*)\]\(([^)]+)\)', line)
            
            for match in image_matches:
                alt_text = match.group(1)
                image_url = match.group(2)
                
                # Check for missing alt text
                if not alt_text.strip():
                    self._add_issue(
                        file_path, line_num, 'alt_text', 'A', 'critical',
                        f"Image missing alt text: {image_url}",
                        "Add descriptive alt text: ![Description of image](url)",
                        match.group(0), line.strip()
                    )
                
                # Check for poor alt text
                elif alt_text.lower() in ['image', 'picture', 'photo', 'img', 'screenshot']:
                    self._add_issue(
                        file_path, line_num, 'alt_text', 'A', 'major',
                        f"Non-descriptive alt text: '{alt_text}'",
                        "Use descriptive alt text that explains the image content",
                        match.group(0), line.strip()
                    )
                
                # Check for redundant alt text
                elif 'image of' in alt_text.lower() or 'picture of' in alt_text.lower():
                    self._add_issue(
                        file_path, line_num, 'alt_text', 'AA', 'minor',
                        f"Redundant alt text: '{alt_text}'",
                        "Remove redundant phrases like 'image of' from alt text",
                        match.group(0), line.strip()
                    )
            
            # Check for HTML img tags
            html_img_matches = re.finditer(r'<img[^>]*>', line)
            for match in html_img_matches:
                img_tag = match.group(0)
                
                # Check for alt attribute
                if 'alt=' not in img_tag:
                    self._add_issue(
                        file_path, line_num, 'alt_text', 'A', 'critical',
                        "HTML img tag missing alt attribute",
                        "Add alt attribute to img tag: <img src='...' alt='description'>",
                        img_tag, line.strip()
                    )
    
    def _test_headings_accessibility(self, file_path: Path, lines: List[str]):
        """Test heading hierarchy and structure"""
        heading_levels = []
        
        for line_num, line in enumerate(lines, 1):
            heading_match = self.patterns['heading'].match(line)
            
            if heading_match:
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()
                heading_levels.append((line_num, level, title))
                
                # Check for empty headings
                if not title:
                    self._add_issue(
                        file_path, line_num, 'heading_hierarchy', 'A', 'critical',
                        "Empty heading found",
                        "Add descriptive heading text",
                        line.strip(), line.strip()
                    )
                
                # Check for non-descriptive headings
                if title.lower() in ['click here', 'read more', 'more info', 'here']:
                    self._add_issue(
                        file_path, line_num, 'heading_hierarchy', 'AA', 'major',
                        f"Non-descriptive heading: '{title}'",
                        "Use descriptive headings that explain the section content",
                        line.strip(), line.strip()
                    )
        
        # Check heading hierarchy
        for i, (line_num, level, title) in enumerate(heading_levels[1:], 1):
            prev_level = heading_levels[i-1][1]
            
            if level > prev_level + 1:
                self._add_issue(
                    file_path, line_num, 'heading_hierarchy', 'AA', 'major',
                    f"Heading level {level} follows level {prev_level} (skipped level)",
                    "Use consecutive heading levels for proper document structure",
                    f"# Level {level}: {title}", lines[line_num-1]
                )
    
    def _test_links_accessibility(self, file_path: Path, lines: List[str]):
        """Test link accessibility and purpose"""
        for line_num, line in enumerate(lines, 1):
            link_matches = re.finditer(r'\[([^\]]*)\]\(([^)]+)\)', line)
            
            for match in link_matches:
                link_text = match.group(1)
                url = match.group(2)
                
                # Check for empty link text
                if not link_text.strip():
                    self._add_issue(
                        file_path, line_num, 'link_purpose', 'A', 'critical',
                        f"Link with empty text: {url}",
                        "Add descriptive link text that explains the link purpose",
                        match.group(0), line.strip()
                    )
                
                # Check for non-descriptive link text
                elif link_text.lower() in ['click here', 'here', 'this', 'that', 'read more', 'more']:
                    self._add_issue(
                        file_path, line_num, 'link_purpose', 'AA', 'major',
                        f"Non-descriptive link text: '{link_text}'",
                        "Use descriptive link text that explains where the link goes",
                        match.group(0), line.strip()
                    )
                
                # Check for URL as link text
                elif link_text == url:
                    self._add_issue(
                        file_path, line_num, 'link_purpose', 'AA', 'minor',
                        f"URL used as link text: {link_text}",
                        "Use descriptive text instead of the raw URL",
                        match.group(0), line.strip()
                    )
                
                # Check for overly long link text
                elif len(link_text) > 100:
                    self._add_issue(
                        file_path, line_num, 'link_purpose', 'AA', 'minor',
                        f"Link text too long ({len(link_text)} characters)",
                        "Keep link text concise while remaining descriptive",
                        match.group(0), line.strip()
                    )
    
    def _test_tables_accessibility(self, file_path: Path, lines: List[str]):
        """Test table accessibility"""
        in_table = False
        table_start_line = None
        has_header = False
        
        for line_num, line in enumerate(lines, 1):
            # Check if line is a table row
            if '|' in line and line.strip().startswith('|') and line.strip().endswith('|'):
                if not in_table:
                    in_table = True
                    table_start_line = line_num
                    has_header = False
                
                # Check if this is a header row (next line should be separator)
                if line_num < len(lines) and '---' in lines[line_num]:
                    has_header = True
            
            # Check for table separator
            elif in_table and '---' in line:
                continue
            
            # End of table
            elif in_table and '|' not in line:
                # Check if table had proper headers
                if not has_header:
                    self._add_issue(
                        file_path, table_start_line, 'table_headers', 'A', 'major',
                        "Table missing header row",
                        "Add header row with column descriptions followed by separator (|---|---|)",
                        "Table without headers", f"Lines {table_start_line}-{line_num-1}"
                    )
                
                in_table = False
                table_start_line = None
                has_header = False
        
        # Check if we ended while still in a table
        if in_table and not has_header:
            self._add_issue(
                file_path, table_start_line, 'table_headers', 'A', 'major',
                "Table missing header row",
                "Add header row with column descriptions",
                "Table without headers", f"Lines {table_start_line}-{len(lines)}"
            )
    
    def _test_language_accessibility(self, file_path: Path, content: str):
        """Test language and readability accessibility"""
        # Check for language identification in frontmatter
        if content.startswith('---'):
            frontmatter_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
            if frontmatter_match:
                frontmatter = frontmatter_match.group(1)
                if 'lang:' not in frontmatter and 'language:' not in frontmatter:
                    self._add_issue(
                        file_path, 1, 'language_identification', 'A', 'minor',
                        "Document missing language identification",
                        "Add 'lang: en' to frontmatter for proper language identification",
                        "Missing language tag", "Frontmatter"
                    )
        
        # Check for abbreviations without expansion
        abbreviations = re.findall(r'\b[A-Z]{2,}\b', content)
        common_abbrevs = {'API', 'URL', 'HTTP', 'HTTPS', 'HTML', 'CSS', 'JS', 'UI', 'UX'}
        
        for abbrev in set(abbreviations):
            if abbrev not in common_abbrevs and content.count(abbrev) > 2:
                self._add_issue(
                    file_path, 1, 'abbreviation_expansion', 'AAA', 'minor',
                    f"Abbreviation '{abbrev}' used without expansion",
                    f"Define abbreviation on first use: '{abbrev} (Full Term)'",
                    abbrev, "Throughout document"
                )
    
    def _test_structure_accessibility(self, file_path: Path, content: str, lines: List[str]):
        """Test document structure accessibility"""
        # Check for page title (H1)
        h1_count = len(re.findall(r'^# ', content, re.MULTILINE))
        
        if h1_count == 0:
            self._add_issue(
                file_path, 1, 'page_titles', 'A', 'major',
                "Document missing main heading (H1)",
                "Add a main heading with # to identify the page content",
                "Missing H1", "Document structure"
            )
        elif h1_count > 1:
            self._add_issue(
                file_path, 1, 'page_titles', 'A', 'minor',
                f"Document has multiple H1 headings ({h1_count})",
                "Use only one H1 heading per page for proper document structure",
                "Multiple H1s", "Document structure"
            )
        
        # Check for skip links or navigation structure
        has_toc = any('toc' in line.lower() or 'table of contents' in line.lower() for line in lines)
        if len(lines) > 100 and not has_toc:
            self._add_issue(
                file_path, 1, 'consistent_navigation', 'AA', 'minor',
                "Long document without table of contents",
                "Consider adding table of contents for easier navigation",
                "No TOC", "Document navigation"
            )
    
    def _test_html_accessibility(self):
        """Test accessibility of generated HTML files"""
        html_files = list(self.site_dir.rglob("*.html"))
        self.logger.info(f"Testing {len(html_files)} HTML files for accessibility")
        
        for html_file in html_files:
            self._test_html_file_accessibility(html_file)
    
    def _test_html_file_accessibility(self, html_file: Path):
        """Test accessibility of a single HTML file"""
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Test HTML-specific accessibility
            self._test_html_structure(html_file, soup)
            self._test_html_forms(html_file, soup)
            self._test_html_interactive_elements(html_file, soup)
            self._test_html_semantic_markup(html_file, soup)
            
        except Exception as e:
            self._add_issue(
                html_file, 1, 'file_error', 'A', 'critical',
                f"Error reading HTML file: {e}",
                "Ensure HTML file is valid and readable"
            )
    
    def _test_html_structure(self, html_file: Path, soup: BeautifulSoup):
        """Test HTML structural accessibility"""
        # Check for page title
        title = soup.find('title')
        if not title or not title.get_text().strip():
            self._add_issue(
                html_file, 1, 'page_titles', 'A', 'critical',
                "HTML page missing title element",
                "Add descriptive title element to HTML head",
                str(title) if title else "Missing title"
            )
        
        # Check for lang attribute on html element
        html_elem = soup.find('html')
        if html_elem and not html_elem.get('lang'):
            self._add_issue(
                html_file, 1, 'language_identification', 'A', 'major',
                "HTML element missing lang attribute",
                "Add lang attribute to html element: <html lang='en'>",
                str(html_elem)[:100] + "..."
            )
        
        # Check for proper heading hierarchy
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        prev_level = 0
        
        for heading in headings:
            level = int(heading.name[1])
            
            if level > prev_level + 1:
                self._add_issue(
                    html_file, 1, 'heading_hierarchy', 'AA', 'major',
                    f"Heading level {level} follows level {prev_level} (skipped level)",
                    "Use consecutive heading levels",
                    str(heading)
                )
            
            prev_level = level
    
    def _test_html_forms(self, html_file: Path, soup: BeautifulSoup):
        """Test form accessibility"""
        forms = soup.find_all('form')
        
        for form in forms:
            # Check for form labels
            inputs = form.find_all(['input', 'select', 'textarea'])
            
            for input_elem in inputs:
                input_id = input_elem.get('id')
                input_type = input_elem.get('type', 'text')
                
                # Skip hidden inputs and buttons
                if input_type in ['hidden', 'submit', 'button']:
                    continue
                
                # Check for associated label
                label = None
                if input_id:
                    label = soup.find('label', {'for': input_id})
                
                if not label:
                    # Check for aria-label or aria-labelledby
                    if not input_elem.get('aria-label') and not input_elem.get('aria-labelledby'):
                        self._add_issue(
                            html_file, 1, 'form_labels', 'A', 'critical',
                            f"Form input missing label: {input_elem.get('name', 'unnamed')}",
                            "Add label element or aria-label attribute",
                            str(input_elem)
                        )
    
    def _test_html_interactive_elements(self, html_file: Path, soup: BeautifulSoup):
        """Test interactive element accessibility"""
        # Check buttons
        buttons = soup.find_all('button')
        for button in buttons:
            if not button.get_text().strip() and not button.get('aria-label'):
                self._add_issue(
                    html_file, 1, 'button_text', 'A', 'critical',
                    "Button missing accessible text",
                    "Add text content or aria-label to button",
                    str(button)
                )
        
        # Check links
        links = soup.find_all('a', href=True)
        for link in links:
            if not link.get_text().strip() and not link.get('aria-label'):
                self._add_issue(
                    html_file, 1, 'link_purpose', 'A', 'critical',
                    "Link missing accessible text",
                    "Add text content or aria-label to link",
                    str(link)
                )
    
    def _test_html_semantic_markup(self, html_file: Path, soup: BeautifulSoup):
        """Test semantic markup accessibility"""
        # Check for semantic landmarks
        landmarks = ['header', 'nav', 'main', 'aside', 'footer']
        found_landmarks = []
        
        for landmark in landmarks:
            if soup.find(landmark):
                found_landmarks.append(landmark)
        
        if 'main' not in found_landmarks:
            self._add_issue(
                html_file, 1, 'semantic_markup', 'AA', 'major',
                "Page missing main landmark",
                "Add <main> element to identify primary content",
                "Missing semantic structure"
            )
    
    def _add_issue(self, file_path: Path, line_number: int, issue_type: str, 
                   wcag_level: str, severity: str, message: str, recommendation: str,
                   element: Optional[str] = None, context: Optional[str] = None):
        """Add an accessibility issue to the results"""
        issue = AccessibilityIssue(
            file_path=str(file_path),
            line_number=line_number,
            issue_type=issue_type,
            wcag_level=wcag_level,
            severity=severity,
            message=message,
            recommendation=recommendation,
            element=element,
            context=context
        )
        self.issues.append(issue)
    
    def _generate_accessibility_report(self) -> Dict[str, Any]:
        """Generate comprehensive accessibility report"""
        # Group issues by various criteria
        by_severity = {'critical': [], 'major': [], 'minor': []}
        by_wcag_level = {'A': [], 'AA': [], 'AAA': []}
        by_type = {}
        by_file = {}
        
        for issue in self.issues:
            by_severity[issue.severity].append(issue)
            by_wcag_level[issue.wcag_level].append(issue)
            
            if issue.issue_type not in by_type:
                by_type[issue.issue_type] = []
            by_type[issue.issue_type].append(issue)
            
            if issue.file_path not in by_file:
                by_file[issue.file_path] = []
            by_file[issue.file_path].append(issue)
        
        # Calculate accessibility score
        total_issues = len(self.issues)
        critical_count = len(by_severity['critical'])
        major_count = len(by_severity['major'])
        minor_count = len(by_severity['minor'])
        
        # Accessibility score (0-100)
        accessibility_score = max(0, 100 - (critical_count * 15) - (major_count * 5) - (minor_count * 1))
        
        # WCAG compliance assessment
        wcag_compliance = {
            'A': len(by_wcag_level['A']) == 0,
            'AA': len(by_wcag_level['A']) == 0 and len(by_wcag_level['AA']) == 0,
            'AAA': total_issues == 0
        }
        
        report = {
            'summary': {
                'total_issues': total_issues,
                'critical_issues': critical_count,
                'major_issues': major_count,
                'minor_issues': minor_count,
                'accessibility_score': round(accessibility_score, 1),
                'wcag_compliance': wcag_compliance,
                'files_tested': len(by_file),
                'compliant_files': len([f for f, issues in by_file.items() if not issues])
            },
            'wcag_breakdown': {
                'level_A_issues': len(by_wcag_level['A']),
                'level_AA_issues': len(by_wcag_level['AA']),
                'level_AAA_issues': len(by_wcag_level['AAA'])
            },
            'issues_by_type': {
                issue_type: len(issues) 
                for issue_type, issues in by_type.items()
            },
            'issues_by_file': {
                file_path: {
                    'total': len(issues),
                    'critical': len([i for i in issues if i.severity == 'critical']),
                    'major': len([i for i in issues if i.severity == 'major']),
                    'minor': len([i for i in issues if i.severity == 'minor'])
                }
                for file_path, issues in by_file.items()
            },
            'detailed_issues': [
                {
                    'file': issue.file_path,
                    'line': issue.line_number,
                    'type': issue.issue_type,
                    'wcag_level': issue.wcag_level,
                    'severity': issue.severity,
                    'message': issue.message,
                    'recommendation': issue.recommendation,
                    'element': issue.element,
                    'context': issue.context
                }
                for issue in sorted(self.issues, key=lambda x: (x.severity, x.file_path, x.line_number))
            ],
            'recommendations': self._generate_accessibility_recommendations(by_type, by_severity, wcag_compliance)
        }
        
        return report
    
    def _generate_accessibility_recommendations(self, by_type: Dict[str, List], 
                                               by_severity: Dict[str, List],
                                               wcag_compliance: Dict[str, bool]) -> List[str]:
        """Generate actionable accessibility recommendations"""
        recommendations = []
        
        if by_severity['critical']:
            recommendations.append("🚨 Fix all critical accessibility issues immediately - they prevent access for users with disabilities")
        
        if not wcag_compliance['A']:
            recommendations.append("🎯 Focus on achieving WCAG 2.1 Level A compliance first")
        elif not wcag_compliance['AA']:
            recommendations.append("🎯 Work towards WCAG 2.1 Level AA compliance for better accessibility")
        
        if 'alt_text' in by_type:
            recommendations.append("🖼️ Add descriptive alt text to all images for screen reader users")
        
        if 'heading_hierarchy' in by_type:
            recommendations.append("📋 Fix heading hierarchy to improve document structure and navigation")
        
        if 'link_purpose' in by_type:
            recommendations.append("🔗 Use descriptive link text that explains the link destination")
        
        if 'form_labels' in by_type:
            recommendations.append("📝 Add proper labels to all form inputs for screen reader accessibility")
        
        if 'language_identification' in by_type:
            recommendations.append("🌍 Add language identification to improve screen reader pronunciation")
        
        recommendations.extend([
            "♿ Test documentation with screen readers (NVDA, JAWS, VoiceOver)",
            "⌨️ Verify all functionality is accessible via keyboard navigation",
            "🎨 Check color contrast ratios meet WCAG standards",
            "📱 Test accessibility on mobile devices and different screen sizes",
            "🔄 Integrate accessibility testing into CI/CD pipeline",
            "👥 Include users with disabilities in testing processes"
        ])
        
        return recommendations

def main():
    """Main execution function"""
    tester = AccessibilityTester()
    report = tester.test_accessibility()
    
    # Save report
    report_path = Path("tests/docs-qa/accessibility_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print(f"\n♿ Accessibility Testing Complete!")
    print(f"🎯 Accessibility Score: {report['summary']['accessibility_score']}/100")
    print(f"🚨 Critical Issues: {report['summary']['critical_issues']}")
    print(f"⚠️  Major Issues: {report['summary']['major_issues']}")
    print(f"ℹ️  Minor Issues: {report['summary']['minor_issues']}")
    
    # WCAG Compliance
    compliance = report['summary']['wcag_compliance']
    print(f"\n📊 WCAG 2.1 Compliance:")
    print(f"   Level A: {'✅ Compliant' if compliance['A'] else '❌ Non-compliant'}")
    print(f"   Level AA: {'✅ Compliant' if compliance['AA'] else '❌ Non-compliant'}")
    print(f"   Level AAA: {'✅ Compliant' if compliance['AAA'] else '❌ Non-compliant'}")
    
    print(f"\n📄 Report saved to: {report_path}")
    
    if report['summary']['critical_issues'] > 0:
        print(f"\n🚨 Critical accessibility issues must be fixed:")
        critical_issues = [i for i in report['detailed_issues'] if i['severity'] == 'critical']
        for issue in critical_issues[:5]:
            print(f"  - {issue['file']}:{issue['line']} - {issue['message']}")

if __name__ == "__main__":
    main()