#!/usr/bin/env python3
"""
Documentation structure validator for MediaNest.
Validates the documentation structure against expected standards.
"""

import os
import sys
import yaml
import json
from pathlib import Path
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class DocsStructureValidator:
    def __init__(self, docs_dir, mkdocs_config):
        self.docs_dir = Path(docs_dir)
        self.mkdocs_config = mkdocs_config
        self.issues = []
        self.config_nav = None
        
        # Load MkDocs configuration
        if os.path.exists(mkdocs_config):
            with open(mkdocs_config, 'r') as f:
                self.config = yaml.safe_load(f)
                self.config_nav = self.config.get('nav', [])
        else:
            logger.error(f"MkDocs config not found: {mkdocs_config}")
            sys.exit(1)
    
    def validate_structure(self):
        """Run all validation checks."""
        self._check_required_files()
        self._check_navigation_files()
        self._check_index_files()
        self._check_orphaned_files()
        self._check_empty_files()
        self._check_frontmatter()
        self._check_heading_structure()
        
        return len(self.issues) == 0
    
    def _check_required_files(self):
        """Check for required documentation files."""
        required_files = [
            'index.md',
            'getting-started/index.md',
            'installation/index.md',
            'user-guides/index.md',
            'api/index.md',
            'developers/index.md',
            'troubleshooting/index.md',
            'reference/index.md'
        ]
        
        for file_path in required_files:
            full_path = self.docs_dir / file_path
            if not full_path.exists():
                self.issues.append({
                    'type': 'missing_required_file',
                    'file': file_path,
                    'message': f'Required file missing: {file_path}'
                })
    
    def _check_navigation_files(self):
        """Check that all files in navigation exist."""
        def check_nav_item(nav_item, parent_path=""):
            if isinstance(nav_item, dict):
                for key, value in nav_item.items():
                    if isinstance(value, str):
                        # This is a file reference
                        file_path = self.docs_dir / value
                        if not file_path.exists():
                            self.issues.append({
                                'type': 'missing_nav_file',
                                'file': value,
                                'nav_title': key,
                                'message': f'Navigation file missing: {value} (titled "{key}")'
                            })
                    elif isinstance(value, list):
                        # This is a section with sub-items
                        for sub_item in value:
                            check_nav_item(sub_item, key)
            elif isinstance(nav_item, str):
                # Direct file reference
                file_path = self.docs_dir / nav_item
                if not file_path.exists():
                    self.issues.append({
                        'type': 'missing_nav_file',
                        'file': nav_item,
                        'message': f'Navigation file missing: {nav_item}'
                    })
        
        if self.config_nav:
            for nav_item in self.config_nav:
                check_nav_item(nav_item)
    
    def _check_index_files(self):
        """Check that directories have index files."""
        for subdir in self.docs_dir.iterdir():
            if subdir.is_dir() and not subdir.name.startswith('.'):
                index_file = subdir / 'index.md'
                if not index_file.exists():
                    # Check if there are any .md files in the directory
                    md_files = list(subdir.glob('*.md'))
                    if md_files:
                        self.issues.append({
                            'type': 'missing_index',
                            'directory': str(subdir.relative_to(self.docs_dir)),
                            'message': f'Directory {subdir.name}/ has markdown files but no index.md'
                        })
    
    def _check_orphaned_files(self):
        """Check for markdown files not referenced in navigation."""
        # Get all files from navigation
        nav_files = set()
        
        def collect_nav_files(nav_item):
            if isinstance(nav_item, dict):
                for key, value in nav_item.items():
                    if isinstance(value, str):
                        nav_files.add(value)
                    elif isinstance(value, list):
                        for sub_item in value:
                            collect_nav_files(sub_item)
            elif isinstance(nav_item, str):
                nav_files.add(nav_item)
        
        if self.config_nav:
            for nav_item in self.config_nav:
                collect_nav_files(nav_item)
        
        # Get all markdown files
        all_md_files = set()
        for md_file in self.docs_dir.rglob('*.md'):
            rel_path = md_file.relative_to(self.docs_dir)
            all_md_files.add(str(rel_path))
        
        # Find orphaned files
        orphaned = all_md_files - nav_files
        
        # Filter out common files that don't need to be in navigation
        exclude_patterns = {'README.md', 'CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTING.md'}
        orphaned = {f for f in orphaned if Path(f).name not in exclude_patterns}
        
        for orphaned_file in orphaned:
            self.issues.append({
                'type': 'orphaned_file',
                'file': orphaned_file,
                'message': f'File not referenced in navigation: {orphaned_file}'
            })
    
    def _check_empty_files(self):
        """Check for empty markdown files."""
        for md_file in self.docs_dir.rglob('*.md'):
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                
                if not content:
                    rel_path = md_file.relative_to(self.docs_dir)
                    self.issues.append({
                        'type': 'empty_file',
                        'file': str(rel_path),
                        'message': f'File is empty: {rel_path}'
                    })
                elif len(content) < 50:  # Very short files
                    rel_path = md_file.relative_to(self.docs_dir)
                    self.issues.append({
                        'type': 'very_short_file',
                        'file': str(rel_path),
                        'message': f'File is very short ({len(content)} chars): {rel_path}'
                    })
            except Exception as e:
                rel_path = md_file.relative_to(self.docs_dir)
                self.issues.append({
                    'type': 'read_error',
                    'file': str(rel_path),
                    'message': f'Could not read file: {e}'
                })
    
    def _check_frontmatter(self):
        """Check for proper frontmatter in markdown files."""
        for md_file in self.docs_dir.rglob('*.md'):
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                rel_path = md_file.relative_to(self.docs_dir)
                
                # Check if file starts with frontmatter
                if content.startswith('---'):
                    try:
                        # Extract frontmatter
                        parts = content.split('---', 2)
                        if len(parts) >= 3:
                            frontmatter = yaml.safe_load(parts[1])
                            
                            # Check for required frontmatter fields
                            if not frontmatter.get('title'):
                                self.issues.append({
                                    'type': 'missing_title',
                                    'file': str(rel_path),
                                    'message': f'File missing title in frontmatter: {rel_path}'
                                })
                        else:
                            self.issues.append({
                                'type': 'invalid_frontmatter',
                                'file': str(rel_path),
                                'message': f'Invalid frontmatter format: {rel_path}'
                            })
                    except yaml.YAMLError as e:
                        self.issues.append({
                            'type': 'invalid_frontmatter',
                            'file': str(rel_path),
                            'message': f'Invalid YAML in frontmatter: {e}'
                        })
                else:
                    # Files should have at least a title
                    if not content.startswith('#'):
                        self.issues.append({
                            'type': 'missing_title_heading',
                            'file': str(rel_path),
                            'message': f'File missing title heading or frontmatter: {rel_path}'
                        })
            except Exception as e:
                rel_path = md_file.relative_to(self.docs_dir)
                self.issues.append({
                    'type': 'read_error',
                    'file': str(rel_path),
                    'message': f'Could not read file: {e}'
                })
    
    def _check_heading_structure(self):
        """Check for proper heading structure."""
        import re
        
        for md_file in self.docs_dir.rglob('*.md'):
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                rel_path = md_file.relative_to(self.docs_dir)
                
                # Find all headings
                headings = re.findall(r'^(#{1,6})\s+(.+)$', content, re.MULTILINE)
                
                if not headings:
                    continue
                
                # Check heading levels
                prev_level = 0
                for heading_match in headings:
                    level = len(heading_match[0])
                    title = heading_match[1].strip()
                    
                    # Check for skipped levels
                    if level > prev_level + 1:
                        self.issues.append({
                            'type': 'skipped_heading_level',
                            'file': str(rel_path),
                            'heading': title,
                            'message': f'Heading level skipped (h{prev_level} to h{level}): "{title}"'
                        })
                    
                    prev_level = level
                
                # Check if first heading is h1
                first_heading_level = len(headings[0][0]) if headings else 0
                if first_heading_level > 1:
                    self.issues.append({
                        'type': 'no_h1_heading',
                        'file': str(rel_path),
                        'message': f'First heading is not h1: {rel_path}'
                    })
                
            except Exception as e:
                rel_path = md_file.relative_to(self.docs_dir)
                self.issues.append({
                    'type': 'read_error',
                    'file': str(rel_path),
                    'message': f'Could not read file: {e}'
                })
    
    def generate_report(self):
        """Generate validation report."""
        if not self.issues:
            return "✅ Documentation structure is valid!"
        
        # Group issues by type
        issues_by_type = {}
        for issue in self.issues:
            issue_type = issue['type']
            if issue_type not in issues_by_type:
                issues_by_type[issue_type] = []
            issues_by_type[issue_type].append(issue)
        
        report = f"❌ Found {len(self.issues)} documentation structure issues:\n\n"
        
        type_descriptions = {
            'missing_required_file': 'Missing Required Files',
            'missing_nav_file': 'Missing Navigation Files',
            'missing_index': 'Missing Index Files',
            'orphaned_file': 'Orphaned Files',
            'empty_file': 'Empty Files',
            'very_short_file': 'Very Short Files',
            'missing_title': 'Missing Titles in Frontmatter',
            'missing_title_heading': 'Missing Title Headings',
            'invalid_frontmatter': 'Invalid Frontmatter',
            'skipped_heading_level': 'Skipped Heading Levels',
            'no_h1_heading': 'Missing H1 Headings',
            'read_error': 'File Read Errors'
        }
        
        for issue_type, type_issues in issues_by_type.items():
            description = type_descriptions.get(issue_type, issue_type.replace('_', ' ').title())
            report += f"## {description} ({len(type_issues)} issues)\n\n"
            
            for issue in type_issues:
                report += f"- {issue['message']}\n"
            
            report += "\n"
        
        return report
    
    def save_report(self, filename='docs-structure-report.json'):
        """Save the report as JSON."""
        report_data = {
            'total_issues': len(self.issues),
            'issues': self.issues,
            'status': 'success' if len(self.issues) == 0 else 'failed'
        }
        
        with open(filename, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        logger.info(f"Report saved to {filename}")

def main():
    parser = argparse.ArgumentParser(description='Validate documentation structure')
    parser.add_argument('--docs-dir', default='docs', help='Path to the docs directory')
    parser.add_argument('--config', default='mkdocs.yml', help='Path to MkDocs config file')
    parser.add_argument('--report', help='Save report to JSON file', default='docs-structure-report.json')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    if not os.path.exists(args.docs_dir):
        logger.error(f"Docs directory not found: {args.docs_dir}")
        return 1
    
    if not os.path.exists(args.config):
        logger.error(f"MkDocs config not found: {args.config}")
        return 1
    
    validator = DocsStructureValidator(args.docs_dir, args.config)
    
    # Run validation
    validator.validate_structure()
    
    # Print report
    print(validator.generate_report())
    
    # Save report
    validator.save_report(args.report)
    
    # Return exit code
    return 0 if len(validator.issues) == 0 else 1

if __name__ == '__main__':
    sys.exit(main())