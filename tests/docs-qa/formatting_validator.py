#!/usr/bin/env python3
"""
Comprehensive Formatting Validator for MediaNest Documentation
Validates markdown formatting, style consistency, and MkDocs compliance.
"""

import os
import re
import yaml
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Set, Optional, Tuple, Any
import json
import logging
from collections import defaultdict

@dataclass
class FormattingIssue:
    """Represents a formatting issue found in documentation"""
    file_path: str
    line_number: int
    issue_type: str
    severity: str  # 'error', 'warning', 'info'
    message: str
    suggestion: Optional[str] = None
    line_content: Optional[str] = None

class FormattingValidator:
    """Comprehensive markdown formatting and style validator"""
    
    def __init__(self, docs_dir: str = "docs", mkdocs_config: str = "mkdocs.yml"):
        self.docs_dir = Path(docs_dir)
        self.mkdocs_config = Path(mkdocs_config)
        self.issues: List[FormattingIssue] = []
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Load MkDocs configuration
        self.mkdocs_nav = self._load_mkdocs_nav()
        
        # Style rules configuration
        self.style_rules = {
            'heading_style': 'atx',  # atx (#) or setext (===)
            'list_marker': 'dash',   # dash (-) or asterisk (*)
            'emphasis_marker': 'asterisk',  # asterisk (*) or underscore (_)
            'code_fence': 'backtick',  # backtick (```) or tilde (~~~)
            'line_length': 120,
            'trailing_whitespace': False,
            'blank_lines_around_headers': True,
            'blank_lines_around_lists': True,
            'blank_lines_around_code_blocks': True
        }
        
        # Common formatting patterns
        self.patterns = {
            'heading_atx': re.compile(r'^(#{1,6})\s+(.+)$'),
            'heading_setext': re.compile(r'^.+\n[=-]+$', re.MULTILINE),
            'list_item': re.compile(r'^(\s*)([*+-]|\d+\.)\s+(.+)$'),
            'code_fence_backtick': re.compile(r'^```(\w*)\n(.*?)^```$', re.MULTILINE | re.DOTALL),
            'code_fence_tilde': re.compile(r'^~~~(\w*)\n(.*?)^~~~$', re.MULTILINE | re.DOTALL),
            'inline_code': re.compile(r'`([^`]+)`'),
            'emphasis_asterisk': re.compile(r'\*([^*]+)\*'),
            'emphasis_underscore': re.compile(r'_([^_]+)_'),
            'strong_asterisk': re.compile(r'\*\*([^*]+)\*\*'),
            'strong_underscore': re.compile(r'__([^_]+)__'),
            'link_markdown': re.compile(r'\[([^\]]*)\]\(([^)]+)\)'),
            'image_markdown': re.compile(r'!\[([^\]]*)\]\(([^)]+)\)'),
            'horizontal_rule': re.compile(r'^(\*{3,}|-{3,}|_{3,})$'),
            'table_header': re.compile(r'^\|(.+)\|$'),
            'trailing_whitespace': re.compile(r'[ \t]+$'),
            'multiple_blank_lines': re.compile(r'\n\s*\n\s*\n'),
            'html_tag': re.compile(r'<[^>]+>'),
            'admonition': re.compile(r'^!!! (\w+)( "([^"]*)")?'),
            'yaml_frontmatter': re.compile(r'^---\n(.*?)\n---', re.DOTALL)
        }
    
    def _load_mkdocs_nav(self) -> Dict[str, Any]:
        """Load MkDocs navigation structure"""
        try:
            with open(self.mkdocs_config, 'r', encoding='utf-8') as f:
                # Simple YAML loading that ignores !ENV tags
                content = f.read()
                # Replace !ENV tags with placeholder values for parsing
                content = content.replace('!ENV', '""  # ENV')
                config = yaml.safe_load(content)
                return config.get('nav', [])
        except Exception as e:
            self.logger.warning(f"Could not load MkDocs config: {e}")
            return {}
    
    def validate_all_files(self) -> Dict[str, Any]:
        """Validate all markdown files in the documentation"""
        self.logger.info(f"Starting comprehensive formatting validation in {self.docs_dir}")
        
        # Find all markdown files
        markdown_files = self._find_markdown_files()
        self.logger.info(f"Found {len(markdown_files)} markdown files to validate")
        
        # Validate each file
        for file_path in markdown_files:
            self._validate_file(file_path)
        
        # Validate MkDocs navigation consistency
        self._validate_mkdocs_nav()
        
        # Generate comprehensive report
        report = self._generate_validation_report()
        
        return report
    
    def _find_markdown_files(self) -> List[Path]:
        """Find all markdown files"""
        markdown_files = []
        extensions = {'.md', '.markdown', '.mdx'}
        
        for root, dirs, files in os.walk(self.docs_dir):
            # Skip hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in extensions:
                    markdown_files.append(file_path)
        
        return sorted(markdown_files)
    
    def _validate_file(self, file_path: Path):
        """Validate a single markdown file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Parse YAML frontmatter
            frontmatter = self._extract_frontmatter(content)
            content_start = self._get_content_start_line(content)
            
            # Validate frontmatter
            if frontmatter:
                self._validate_frontmatter(file_path, frontmatter)
            
            # Validate line by line
            for line_num, line in enumerate(lines, 1):
                if line_num < content_start:
                    continue  # Skip frontmatter lines
                
                self._validate_line(file_path, line_num, line, lines)
            
            # Validate document structure
            self._validate_document_structure(file_path, content, lines[content_start-1:])
            
        except Exception as e:
            self._add_issue(
                file_path, 1, 'file_error', 'error',
                f"Error reading file: {e}"
            )
    
    def _extract_frontmatter(self, content: str) -> Optional[Dict[str, Any]]:
        """Extract YAML frontmatter from content"""
        match = self.patterns['yaml_frontmatter'].match(content)
        if match:
            try:
                return yaml.safe_load(match.group(1))
            except yaml.YAMLError:
                pass
        return None
    
    def _get_content_start_line(self, content: str) -> int:
        """Get the line number where content starts (after frontmatter)"""
        if content.startswith('---'):
            lines = content.split('\n')
            for i, line in enumerate(lines[1:], 2):
                if line.strip() == '---':
                    return i + 1
        return 1
    
    def _validate_frontmatter(self, file_path: Path, frontmatter: Dict[str, Any]):
        """Validate YAML frontmatter"""
        required_fields = ['title']
        recommended_fields = ['description', 'tags']
        
        for field in required_fields:
            if field not in frontmatter:
                self._add_issue(
                    file_path, 1, 'missing_frontmatter', 'warning',
                    f"Missing required frontmatter field: {field}",
                    f"Add '{field}: Your Title Here' to the frontmatter"
                )
        
        for field in recommended_fields:
            if field not in frontmatter:
                self._add_issue(
                    file_path, 1, 'missing_frontmatter', 'info',
                    f"Missing recommended frontmatter field: {field}",
                    f"Consider adding '{field}:' to improve SEO and organization"
                )
    
    def _validate_line(self, file_path: Path, line_num: int, line: str, all_lines: List[str]):
        """Validate a single line"""
        # Check line length
        if len(line) > self.style_rules['line_length']:
            self._add_issue(
                file_path, line_num, 'line_too_long', 'warning',
                f"Line exceeds {self.style_rules['line_length']} characters ({len(line)} chars)",
                "Consider breaking long lines or using line breaks",
                line
            )
        
        # Check trailing whitespace
        if self.patterns['trailing_whitespace'].search(line):
            self._add_issue(
                file_path, line_num, 'trailing_whitespace', 'warning',
                "Line has trailing whitespace",
                "Remove trailing spaces/tabs",
                line
            )
        
        # Check heading style
        heading_match = self.patterns['heading_atx'].match(line)
        if heading_match:
            self._validate_heading(file_path, line_num, line, heading_match, all_lines)
        
        # Check list formatting
        list_match = self.patterns['list_item'].match(line)
        if list_match:
            self._validate_list_item(file_path, line_num, line, list_match)
        
        # Check code fence style
        if line.strip().startswith('```') or line.strip().startswith('~~~'):
            self._validate_code_fence(file_path, line_num, line)
        
        # Check emphasis consistency
        self._validate_emphasis_consistency(file_path, line_num, line)
        
        # Check link formatting
        self._validate_links(file_path, line_num, line)
        
        # Check for common markdown mistakes
        self._check_common_mistakes(file_path, line_num, line)
    
    def _validate_heading(self, file_path: Path, line_num: int, line: str, 
                         match: re.Match, all_lines: List[str]):
        """Validate heading formatting"""
        hashes, title = match.groups()
        level = len(hashes)
        
        # Check heading hierarchy
        if hasattr(self, '_last_heading_level'):
            if level > self._last_heading_level + 1:
                self._add_issue(
                    file_path, line_num, 'heading_hierarchy', 'warning',
                    f"Heading level {level} follows level {self._last_heading_level} (skipped level)",
                    "Use consecutive heading levels (e.g., H1 → H2 → H3)",
                    line
                )
        
        self._last_heading_level = level
        
        # Check heading format
        if not title.strip():
            self._add_issue(
                file_path, line_num, 'empty_heading', 'error',
                "Heading has no title",
                "Add descriptive heading text",
                line
            )
        
        # Check spacing around headings
        if self.style_rules['blank_lines_around_headers']:
            # Check line before (if not first line or after frontmatter)
            if line_num > 2 and all_lines[line_num - 2].strip():
                self._add_issue(
                    file_path, line_num, 'heading_spacing', 'info',
                    "Missing blank line before heading",
                    "Add blank line before headings for better readability",
                    line
                )
    
    def _validate_list_item(self, file_path: Path, line_num: int, line: str, match: re.Match):
        """Validate list item formatting"""
        indent, marker, content = match.groups()
        
        # Check list marker consistency
        if marker in ['-', '+', '*']:
            # Unordered list
            if self.style_rules['list_marker'] == 'dash' and marker != '-':
                self._add_issue(
                    file_path, line_num, 'list_marker', 'info',
                    f"Inconsistent list marker '{marker}', prefer '-'",
                    "Use '-' for unordered lists for consistency",
                    line
                )
        
        # Check indentation (should be multiples of 2 or 4)
        indent_len = len(indent)
        if indent_len % 2 != 0 and indent_len % 4 != 0:
            self._add_issue(
                file_path, line_num, 'list_indentation', 'warning',
                f"Irregular list indentation ({indent_len} spaces)",
                "Use 2 or 4 space indentation for lists",
                line
            )
    
    def _validate_code_fence(self, file_path: Path, line_num: int, line: str):
        """Validate code fence formatting"""
        stripped = line.strip()
        
        if stripped.startswith('```'):
            if self.style_rules['code_fence'] == 'tilde' and not stripped.startswith('~~~'):
                self._add_issue(
                    file_path, line_num, 'code_fence_style', 'info',
                    "Code fence uses backticks, prefer tildes",
                    "Use ~~~ for code fences for consistency",
                    line
                )
        elif stripped.startswith('~~~'):
            if self.style_rules['code_fence'] == 'backtick':
                self._add_issue(
                    file_path, line_num, 'code_fence_style', 'info',
                    "Code fence uses tildes, prefer backticks",
                    "Use ``` for code fences for consistency",
                    line
                )
    
    def _validate_emphasis_consistency(self, file_path: Path, line_num: int, line: str):
        """Validate emphasis and strong formatting consistency"""
        # Check emphasis consistency
        asterisk_emphasis = self.patterns['emphasis_asterisk'].findall(line)
        underscore_emphasis = self.patterns['emphasis_underscore'].findall(line)
        
        if asterisk_emphasis and underscore_emphasis:
            self._add_issue(
                file_path, line_num, 'emphasis_inconsistency', 'info',
                "Mixed emphasis markers in same line",
                "Use consistent emphasis markers (* or _) throughout document",
                line
            )
        
        # Check strong formatting consistency
        asterisk_strong = self.patterns['strong_asterisk'].findall(line)
        underscore_strong = self.patterns['strong_underscore'].findall(line)
        
        if asterisk_strong and underscore_strong:
            self._add_issue(
                file_path, line_num, 'strong_inconsistency', 'info',
                "Mixed strong markers in same line",
                "Use consistent strong markers (** or __) throughout document",
                line
            )
    
    def _validate_links(self, file_path: Path, line_num: int, line: str):
        """Validate link formatting"""
        links = self.patterns['link_markdown'].findall(line)
        
        for text, url in links:
            # Check for empty link text
            if not text.strip():
                self._add_issue(
                    file_path, line_num, 'empty_link_text', 'warning',
                    f"Link has empty text: [{text}]({url})",
                    "Provide descriptive link text for accessibility",
                    line
                )
            
            # Check for URL as link text
            if text.strip() == url.strip():
                self._add_issue(
                    file_path, line_num, 'url_as_link_text', 'info',
                    f"URL used as link text: [{text}]({url})",
                    "Use descriptive text instead of URL for better readability",
                    line
                )
    
    def _check_common_mistakes(self, file_path: Path, line_num: int, line: str):
        """Check for common markdown mistakes"""
        # Check for unescaped underscores in words
        if '_' in line and not self.patterns['emphasis_underscore'].search(line):
            words_with_underscores = re.findall(r'\b\w*_\w*\b', line)
            if words_with_underscores:
                self._add_issue(
                    file_path, line_num, 'unescaped_underscore', 'info',
                    f"Unescaped underscores may cause formatting issues: {words_with_underscores}",
                    r"Escape underscores with backslash (\_) if not used for emphasis",
                    line
                )
        
        # Check for multiple consecutive spaces
        if '  ' in line and not line.strip().startswith('    '):  # Ignore code blocks
            self._add_issue(
                file_path, line_num, 'multiple_spaces', 'info',
                "Multiple consecutive spaces found",
                "Use single spaces or proper markdown formatting",
                line
            )
        
        # Check for tabs
        if '\t' in line:
            self._add_issue(
                file_path, line_num, 'tab_character', 'warning',
                "Tab character found, use spaces for indentation",
                "Replace tabs with spaces for consistent rendering",
                line
            )
    
    def _validate_document_structure(self, file_path: Path, full_content: str, content_lines: List[str]):
        """Validate overall document structure"""
        # Reset heading level tracking
        self._last_heading_level = 0
        
        # Check for document title (H1)
        h1_found = False
        for line in content_lines:
            if self.patterns['heading_atx'].match(line):
                match = self.patterns['heading_atx'].match(line)
                if len(match.group(1)) == 1:  # H1
                    h1_found = True
                    break
        
        if not h1_found:
            self._add_issue(
                file_path, 1, 'missing_h1', 'warning',
                "Document missing main heading (H1)",
                "Add a main heading with # at the top of the document"
            )
        
        # Check for multiple blank lines
        multiple_blanks = self.patterns['multiple_blank_lines'].findall(full_content)
        if multiple_blanks:
            self._add_issue(
                file_path, 1, 'multiple_blank_lines', 'info',
                f"Found {len(multiple_blanks)} instances of multiple consecutive blank lines",
                "Use single blank lines for better formatting"
            )
    
    def _validate_mkdocs_nav(self):
        """Validate MkDocs navigation consistency"""
        if not self.mkdocs_nav:
            return
        
        # Extract all referenced files from navigation
        nav_files = set()
        self._extract_nav_files(self.mkdocs_nav, nav_files)
        
        # Find all actual markdown files
        actual_files = set()
        for file_path in self._find_markdown_files():
            # Convert to relative path from docs directory
            rel_path = file_path.relative_to(self.docs_dir)
            actual_files.add(str(rel_path))
        
        # Check for files in nav but not in filesystem
        missing_files = nav_files - actual_files
        for missing_file in missing_files:
            self._add_issue(
                Path("mkdocs.yml"), 1, 'nav_missing_file', 'error',
                f"Navigation references missing file: {missing_file}",
                f"Create the file {missing_file} or remove from navigation"
            )
        
        # Check for files in filesystem but not in nav
        orphaned_files = actual_files - nav_files
        for orphaned_file in orphaned_files:
            # Skip index files and special files
            if orphaned_file.endswith('/index.md') or orphaned_file in ['index.md']:
                continue
                
            self._add_issue(
                Path(orphaned_file), 1, 'nav_orphaned_file', 'info',
                f"File not referenced in navigation: {orphaned_file}",
                f"Add {orphaned_file} to mkdocs.yml navigation or remove if not needed"
            )
    
    def _extract_nav_files(self, nav_section: Any, files: Set[str]):
        """Recursively extract file references from navigation structure"""
        if isinstance(nav_section, list):
            for item in nav_section:
                self._extract_nav_files(item, files)
        elif isinstance(nav_section, dict):
            for key, value in nav_section.items():
                if isinstance(value, str) and value.endswith('.md'):
                    files.add(value)
                else:
                    self._extract_nav_files(value, files)
        elif isinstance(nav_section, str) and nav_section.endswith('.md'):
            files.add(nav_section)
    
    def _add_issue(self, file_path: Path, line_number: int, issue_type: str, 
                   severity: str, message: str, suggestion: Optional[str] = None, 
                   line_content: Optional[str] = None):
        """Add a formatting issue to the results"""
        issue = FormattingIssue(
            file_path=str(file_path),
            line_number=line_number,
            issue_type=issue_type,
            severity=severity,
            message=message,
            suggestion=suggestion,
            line_content=line_content
        )
        self.issues.append(issue)
    
    def _generate_validation_report(self) -> Dict[str, Any]:
        """Generate comprehensive validation report"""
        # Group issues by type and severity
        by_type = defaultdict(list)
        by_severity = defaultdict(list)
        by_file = defaultdict(list)
        
        for issue in self.issues:
            by_type[issue.issue_type].append(issue)
            by_severity[issue.severity].append(issue)
            by_file[issue.file_path].append(issue)
        
        # Calculate scores
        total_issues = len(self.issues)
        error_count = len(by_severity['error'])
        warning_count = len(by_severity['warning'])
        info_count = len(by_severity['info'])
        
        # Quality score calculation (0-100)
        quality_score = max(0, 100 - (error_count * 10) - (warning_count * 3) - (info_count * 1))
        
        report = {
            'summary': {
                'total_issues': total_issues,
                'errors': error_count,
                'warnings': warning_count,
                'info': info_count,
                'quality_score': round(quality_score, 1),
                'files_with_issues': len(by_file),
                'total_files_checked': len(self._find_markdown_files())
            },
            'issues_by_type': {
                issue_type: len(issues) 
                for issue_type, issues in by_type.items()
            },
            'issues_by_file': {
                file_path: {
                    'total': len(issues),
                    'errors': len([i for i in issues if i.severity == 'error']),
                    'warnings': len([i for i in issues if i.severity == 'warning']),
                    'info': len([i for i in issues if i.severity == 'info'])
                }
                for file_path, issues in by_file.items()
            },
            'detailed_issues': [
                {
                    'file': issue.file_path,
                    'line': issue.line_number,
                    'type': issue.issue_type,
                    'severity': issue.severity,
                    'message': issue.message,
                    'suggestion': issue.suggestion,
                    'line_content': issue.line_content
                }
                for issue in sorted(self.issues, key=lambda x: (x.file_path, x.line_number))
            ],
            'recommendations': self._generate_recommendations(by_type, by_severity)
        }
        
        return report
    
    def _generate_recommendations(self, by_type: Dict[str, List[FormattingIssue]], 
                                by_severity: Dict[str, List[FormattingIssue]]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if by_severity['error']:
            recommendations.append("🚨 Fix all errors immediately as they may break documentation rendering")
        
        if 'trailing_whitespace' in by_type:
            recommendations.append("Configure your editor to remove trailing whitespace automatically")
        
        if 'line_too_long' in by_type:
            recommendations.append("Consider setting up line length indicators in your editor")
        
        if 'heading_hierarchy' in by_type:
            recommendations.append("Review document structure and use consecutive heading levels")
        
        if 'nav_missing_file' in by_type:
            recommendations.append("Update navigation in mkdocs.yml to match actual file structure")
        
        if 'missing_frontmatter' in by_type:
            recommendations.append("Add YAML frontmatter to improve SEO and metadata")
        
        recommendations.extend([
            "Set up automated formatting validation in CI/CD pipeline",
            "Use consistent markdown formatting tools across the team",
            "Consider using a markdown linter in your development workflow"
        ])
        
        return recommendations

def main():
    """Main execution function"""
    validator = FormattingValidator()
    report = validator.validate_all_files()
    
    # Save report
    report_path = Path("tests/docs-qa/formatting_validation_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print(f"\n📋 Formatting Validation Complete!")
    print(f"🎯 Quality Score: {report['summary']['quality_score']}/100")
    print(f"❌ Errors: {report['summary']['errors']}")
    print(f"⚠️  Warnings: {report['summary']['warnings']}")
    print(f"ℹ️  Info: {report['summary']['info']}")
    print(f"📁 Files checked: {report['summary']['total_files_checked']}")
    print(f"📄 Report saved to: {report_path}")
    
    if report['summary']['errors'] > 0:
        print(f"\n🚨 Critical Issues Found:")
        for issue in report['detailed_issues']:
            if issue['severity'] == 'error':
                print(f"  - {issue['file']}:{issue['line']} - {issue['message']}")

if __name__ == "__main__":
    main()