#!/usr/bin/env python3
"""
Analyze documentation changes in a PR for quality and impact assessment.
"""

import os
import sys
import subprocess
import json
from pathlib import Path
import argparse
import logging
import re
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class DocsDiffAnalyzer:
    def __init__(self, base_ref='main', head_ref='HEAD'):
        self.base_ref = base_ref
        self.head_ref = head_ref
        self.changes = {
            'added_files': [],
            'modified_files': [],
            'deleted_files': [],
            'renamed_files': [],
            'statistics': {},
            'content_analysis': {},
            'impact_assessment': {}
        }
    
    def analyze_changes(self):
        """Analyze documentation changes between base and head."""
        logger.info(f"Analyzing changes between {self.base_ref} and {self.head_ref}")
        
        # Get changed files
        self._get_changed_files()
        
        # Analyze content changes
        self._analyze_content_changes()
        
        # Assess impact
        self._assess_impact()
        
        return self.changes
    
    def _get_changed_files(self):
        """Get list of changed files."""
        try:
            # Get changed files with status
            cmd = ['git', 'diff', '--name-status', f"{self.base_ref}...{self.head_ref}"]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                
                parts = line.split('\t')
                status = parts[0]
                file_path = parts[1]
                
                # Only analyze documentation files
                if not self._is_docs_file(file_path):
                    continue
                
                if status == 'A':
                    self.changes['added_files'].append(file_path)
                elif status == 'M':
                    self.changes['modified_files'].append(file_path)
                elif status == 'D':
                    self.changes['deleted_files'].append(file_path)
                elif status.startswith('R'):
                    # Renamed file (R100 or similar)
                    old_name = parts[1]
                    new_name = parts[2] if len(parts) > 2 else "unknown"
                    self.changes['renamed_files'].append({
                        'old_name': old_name,
                        'new_name': new_name
                    })
            
            # Calculate statistics
            self.changes['statistics'] = {
                'total_files_changed': len(self.changes['added_files']) + 
                                     len(self.changes['modified_files']) + 
                                     len(self.changes['deleted_files']) + 
                                     len(self.changes['renamed_files']),
                'files_added': len(self.changes['added_files']),
                'files_modified': len(self.changes['modified_files']),
                'files_deleted': len(self.changes['deleted_files']),
                'files_renamed': len(self.changes['renamed_files'])
            }
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to get changed files: {e}")
            return
    
    def _is_docs_file(self, file_path):
        """Check if file is a documentation file."""
        docs_patterns = [
            r'\.md$',
            r'mkdocs\.yml$',
            r'docs/.*\.(md|yml|yaml)$',
            r'README\.md$',
            r'.*\.rst$'
        ]
        
        return any(re.search(pattern, file_path, re.IGNORECASE) for pattern in docs_patterns)
    
    def _analyze_content_changes(self):
        """Analyze content changes in modified files."""
        content_analysis = {
            'lines_added': 0,
            'lines_removed': 0,
            'sections_added': [],
            'sections_removed': [],
            'links_added': [],
            'links_removed': [],
            'images_added': [],
            'images_removed': [],
            'large_changes': []  # Files with significant changes
        }
        
        # Analyze each modified file
        for file_path in self.changes['modified_files']:
            try:
                # Get diff for this file
                cmd = ['git', 'diff', f"{self.base_ref}...{self.head_ref}", '--', file_path]
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                
                diff_content = result.stdout
                
                # Count line changes
                added_lines = len(re.findall(r'^\+(?!\+)', diff_content, re.MULTILINE))
                removed_lines = len(re.findall(r'^-(?!-)', diff_content, re.MULTILINE))
                
                content_analysis['lines_added'] += added_lines
                content_analysis['lines_removed'] += removed_lines
                
                # Check for large changes
                if added_lines + removed_lines > 50:
                    content_analysis['large_changes'].append({
                        'file': file_path,
                        'lines_added': added_lines,
                        'lines_removed': removed_lines
                    })
                
                # Find sections added/removed (headers)
                added_sections = re.findall(r'^\+\s*(#{1,6})\s+(.+)$', diff_content, re.MULTILINE)
                removed_sections = re.findall(r'^-\s*(#{1,6})\s+(.+)$', diff_content, re.MULTILINE)
                
                for level, title in added_sections:
                    content_analysis['sections_added'].append({
                        'file': file_path,
                        'level': len(level),
                        'title': title.strip()
                    })
                
                for level, title in removed_sections:
                    content_analysis['sections_removed'].append({
                        'file': file_path,
                        'level': len(level),
                        'title': title.strip()
                    })
                
                # Find links added/removed
                added_links = re.findall(r'^\+.*\[([^\]]+)\]\(([^)]+)\)', diff_content, re.MULTILINE)
                removed_links = re.findall(r'^-.*\[([^\]]+)\]\(([^)]+)\)', diff_content, re.MULTILINE)
                
                for text, url in added_links:
                    content_analysis['links_added'].append({
                        'file': file_path,
                        'text': text,
                        'url': url
                    })
                
                for text, url in removed_links:
                    content_analysis['links_removed'].append({
                        'file': file_path,
                        'text': text,
                        'url': url
                    })
                
                # Find images added/removed
                added_images = re.findall(r'^\+.*!\[([^\]]*)\]\(([^)]+)\)', diff_content, re.MULTILINE)
                removed_images = re.findall(r'^-.*!\[([^\]]*)\]\(([^)]+)\)', diff_content, re.MULTILINE)
                
                for alt, url in added_images:
                    content_analysis['images_added'].append({
                        'file': file_path,
                        'alt': alt,
                        'url': url
                    })
                
                for alt, url in removed_images:
                    content_analysis['images_removed'].append({
                        'file': file_path,
                        'alt': alt,
                        'url': url
                    })
            
            except subprocess.CalledProcessError:
                logger.warning(f"Failed to analyze diff for {file_path}")
        
        self.changes['content_analysis'] = content_analysis
    
    def _assess_impact(self):
        """Assess the impact of documentation changes."""
        impact = {
            'level': 'low',  # low, medium, high, critical
            'areas_affected': [],
            'breaking_changes': [],
            'recommendations': [],
            'review_focus': []
        }
        
        stats = self.changes['statistics']
        content = self.changes['content_analysis']
        
        # Determine impact level
        if stats['files_deleted'] > 0:
            impact['level'] = 'high'
            impact['breaking_changes'].append(f"{stats['files_deleted']} files deleted")
        
        elif stats['files_added'] > 5 or stats['files_modified'] > 10:
            impact['level'] = 'medium'
        
        elif content.get('lines_added', 0) + content.get('lines_removed', 0) > 200:
            impact['level'] = 'medium'
        
        # Identify affected areas
        all_files = (self.changes['added_files'] + 
                    self.changes['modified_files'] + 
                    self.changes['deleted_files'])
        
        area_mapping = {
            'getting-started': 'User Onboarding',
            'installation': 'Installation Process',
            'api': 'API Documentation',
            'user-guides': 'User Guidance',
            'developers': 'Developer Resources',
            'troubleshooting': 'Support Content',
            'reference': 'Reference Materials',
            'mkdocs.yml': 'Site Configuration'
        }
        
        for file_path in all_files:
            for area, description in area_mapping.items():
                if area in file_path and description not in impact['areas_affected']:
                    impact['areas_affected'].append(description)
        
        # Generate recommendations
        if stats['files_added'] > 0:
            impact['recommendations'].append("Review new files for completeness and consistency")
            impact['review_focus'].append("New content quality")
        
        if stats['files_deleted'] > 0:
            impact['recommendations'].append("Verify that deleted content is not referenced elsewhere")
            impact['review_focus'].append("Broken links check")
        
        if content.get('links_added', []):
            impact['recommendations'].append("Validate all new external links")
            impact['review_focus'].append("Link validation")
        
        if content.get('large_changes', []):
            impact['recommendations'].append("Review files with significant changes for accuracy")
            impact['review_focus'].append("Content accuracy")
        
        if 'mkdocs.yml' in all_files:
            impact['recommendations'].append("Test documentation build after configuration changes")
            impact['review_focus'].append("Build validation")
        
        self.changes['impact_assessment'] = impact
    
    def generate_report(self):
        """Generate human-readable analysis report."""
        stats = self.changes['statistics']
        content = self.changes['content_analysis']
        impact = self.changes['impact_assessment']
        
        report = f"""## Documentation Changes Analysis

### Summary
- **Impact Level**: {impact['level'].upper()}
- **Files Changed**: {stats['total_files_changed']}
  - Added: {stats['files_added']}
  - Modified: {stats['files_modified']}
  - Deleted: {stats['files_deleted']}
  - Renamed: {stats['files_renamed']}

### Content Changes
- **Lines Added**: {content.get('lines_added', 0)}
- **Lines Removed**: {content.get('lines_removed', 0)}
- **Sections Added**: {len(content.get('sections_added', []))}
- **Sections Removed**: {len(content.get('sections_removed', []))}
- **Links Added**: {len(content.get('links_added', []))}
- **Images Added**: {len(content.get('images_added', []))}

### Impact Assessment
**Areas Affected:** {', '.join(impact['areas_affected']) if impact['areas_affected'] else 'None identified'}

"""
        
        if impact['breaking_changes']:
            report += "**⚠️ Potential Breaking Changes:**\n"
            for change in impact['breaking_changes']:
                report += f"- {change}\n"
            report += "\n"
        
        if impact['recommendations']:
            report += "**📝 Recommendations:**\n"
            for rec in impact['recommendations']:
                report += f"- {rec}\n"
            report += "\n"
        
        if impact['review_focus']:
            report += "**🔍 Review Focus Areas:**\n"
            for focus in impact['review_focus']:
                report += f"- {focus}\n"
            report += "\n"
        
        # Large changes details
        if content.get('large_changes'):
            report += "**📊 Files with Significant Changes:**\n"
            for change in content['large_changes']:
                report += f"- `{change['file']}`: +{change['lines_added']}/-{change['lines_removed']} lines\n"
            report += "\n"
        
        # New sections
        if content.get('sections_added'):
            report += "**📑 New Sections Added:**\n"
            for section in content['sections_added'][:5]:  # Show first 5
                report += f"- {section['file']}: {'#' * section['level']} {section['title']}\n"
            if len(content['sections_added']) > 5:
                report += f"- ... and {len(content['sections_added']) - 5} more\n"
            report += "\n"
        
        return report

def main():
    parser = argparse.ArgumentParser(description='Analyze documentation changes in PR')
    parser.add_argument('--base', default='main', help='Base branch for comparison')
    parser.add_argument('--head', default='HEAD', help='Head branch for comparison')
    parser.add_argument('--output', help='Save analysis to JSON file')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    analyzer = DocsDiffAnalyzer(args.base, args.head)
    
    try:
        # Run analysis
        changes = analyzer.analyze_changes()
        
        # Print report
        print(analyzer.generate_report())
        
        # Save detailed analysis if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(changes, f, indent=2)
            logger.info(f"Detailed analysis saved to {args.output}")
        
        return 0
    
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())