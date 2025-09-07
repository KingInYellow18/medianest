#!/usr/bin/env python3
"""
Image validation script for MediaNest documentation.
Checks for missing images, validates image references, and checks alt text.
"""

import os
import re
import sys
from pathlib import Path
import argparse
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class ImageValidator:
    def __init__(self, docs_dir):
        self.docs_dir = Path(docs_dir)
        self.issues = []
        self.image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'}
        
    def validate_files(self, file_paths=None):
        """Validate image references in markdown files."""
        if file_paths:
            md_files = [Path(f) for f in file_paths if f.endswith('.md')]
        else:
            md_files = list(self.docs_dir.rglob('*.md'))
        
        logger.info(f"Validating {len(md_files)} markdown files")
        
        for md_file in md_files:
            if md_file.exists():
                self._validate_file(md_file)
        
        return len(self.issues) == 0
    
    def _validate_file(self, md_file):
        """Validate image references in a single markdown file."""
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            self.issues.append({
                'file': str(md_file),
                'type': 'read_error',
                'message': f'Could not read file: {e}'
            })
            return
        
        # Find all image references
        # Match both ![alt](url) and <img> tags
        md_images = re.findall(r'!\[([^\]]*)\]\(([^\)]+)\)', content)
        html_images = re.findall(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', content)
        
        # Check markdown images
        for alt_text, img_path in md_images:
            self._check_image_reference(md_file, img_path, alt_text, 'markdown')
        
        # Check HTML images
        for img_path in html_images:
            # Extract alt text from img tag
            img_match = re.search(rf'<img[^>]+src=["\']({re.escape(img_path)})["\'][^>]*>', content)
            if img_match:
                img_tag = img_match.group(0)
                alt_match = re.search(r'alt=["\']([^"\']*)["\']', img_tag)
                alt_text = alt_match.group(1) if alt_match else ''
                self._check_image_reference(md_file, img_path, alt_text, 'html')
    
    def _check_image_reference(self, md_file, img_path, alt_text, img_type):
        """Check a single image reference."""
        # Skip external images
        if img_path.startswith(('http://', 'https://', '//')):
            return
        
        # Skip data URLs
        if img_path.startswith('data:'):
            return
        
        # Check alt text
        if not alt_text.strip():
            self.issues.append({
                'file': str(md_file),
                'type': 'missing_alt',
                'image': img_path,
                'format': img_type,
                'message': 'Image missing alt text'
            })
        
        # Check if image file exists
        if img_path.startswith('/'):
            # Absolute path from docs root
            full_path = self.docs_dir / img_path.lstrip('/')
        else:
            # Relative path from markdown file
            full_path = md_file.parent / img_path
        
        # Normalize path
        try:
            full_path = full_path.resolve()
        except Exception:
            self.issues.append({
                'file': str(md_file),
                'type': 'invalid_path',
                'image': img_path,
                'format': img_type,
                'message': 'Invalid image path'
            })
            return
        
        if not full_path.exists():
            self.issues.append({
                'file': str(md_file),
                'type': 'missing_file',
                'image': img_path,
                'format': img_type,
                'message': f'Image file not found: {full_path}'
            })
        else:
            # Check file extension
            if full_path.suffix.lower() not in self.image_extensions:
                self.issues.append({
                    'file': str(md_file),
                    'type': 'invalid_extension',
                    'image': img_path,
                    'format': img_type,
                    'message': f'Unsupported image format: {full_path.suffix}'
                })
            
            # Check file size (warn if > 1MB)
            try:
                file_size = full_path.stat().st_size
                if file_size > 1024 * 1024:  # 1MB
                    self.issues.append({
                        'file': str(md_file),
                        'type': 'large_file',
                        'image': img_path,
                        'format': img_type,
                        'message': f'Large image file ({file_size // 1024}KB). Consider optimizing.'
                    })
            except Exception:
                pass
    
    def find_orphaned_images(self):
        """Find image files that are not referenced in any markdown."""
        # Get all image files
        image_files = set()
        for ext in self.image_extensions:
            image_files.update(self.docs_dir.rglob(f'*{ext}'))
        
        # Get all referenced images
        referenced_images = set()
        for md_file in self.docs_dir.rglob('*.md'):
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Find all image references
                md_images = re.findall(r'!\[[^\]]*\]\(([^\)]+)\)', content)
                html_images = re.findall(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', content)
                
                for img_path in md_images + html_images:
                    if not img_path.startswith(('http://', 'https://', '//', 'data:')):
                        if img_path.startswith('/'):
                            full_path = self.docs_dir / img_path.lstrip('/')
                        else:
                            full_path = md_file.parent / img_path
                        
                        try:
                            referenced_images.add(full_path.resolve())
                        except Exception:
                            pass
            except Exception:
                pass
        
        # Find orphaned images
        orphaned = image_files - referenced_images
        for img_file in orphaned:
            self.issues.append({
                'file': str(img_file),
                'type': 'orphaned',
                'image': str(img_file.relative_to(self.docs_dir)),
                'format': 'file',
                'message': 'Image file not referenced in any documentation'
            })
    
    def generate_report(self):
        """Generate a validation report."""
        if not self.issues:
            return "✅ All image references are valid!"
        
        # Group issues by type
        issues_by_type = {}
        for issue in self.issues:
            issue_type = issue['type']
            if issue_type not in issues_by_type:
                issues_by_type[issue_type] = []
            issues_by_type[issue_type].append(issue)
        
        report = f"❌ Found {len(self.issues)} image validation issues:\n\n"
        
        type_descriptions = {
            'missing_file': 'Missing Image Files',
            'missing_alt': 'Missing Alt Text',
            'invalid_path': 'Invalid Paths',
            'invalid_extension': 'Invalid Extensions',
            'large_file': 'Large Files',
            'orphaned': 'Orphaned Images',
            'read_error': 'File Read Errors'
        }
        
        for issue_type, type_issues in issues_by_type.items():
            description = type_descriptions.get(issue_type, issue_type.replace('_', ' ').title())
            report += f"## {description} ({len(type_issues)} issues)\n\n"
            
            for issue in type_issues:
                if issue_type == 'orphaned':
                    report += f"- `{issue['image']}`\n"
                else:
                    report += f"- **{issue['image']}** in `{issue['file']}`\n"
                    report += f"  {issue['message']}\n"
                report += "\n"
        
        return report
    
    def save_report(self, filename='image-validation-report.json'):
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
    parser = argparse.ArgumentParser(description='Validate image references in documentation')
    parser.add_argument('docs_dir', nargs='?', default='docs', help='Path to the docs directory')
    parser.add_argument('--files', nargs='+', help='Specific files to check')
    parser.add_argument('--report', help='Save report to JSON file', default='image-validation-report.json')
    parser.add_argument('--find-orphaned', action='store_true', help='Find orphaned images')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    if not os.path.exists(args.docs_dir):
        logger.error(f"Docs directory not found: {args.docs_dir}")
        return 1
    
    validator = ImageValidator(args.docs_dir)
    
    # Validate image references
    validator.validate_files(args.files)
    
    # Find orphaned images if requested
    if args.find_orphaned:
        validator.find_orphaned_images()
    
    # Print report
    print(validator.generate_report())
    
    # Save report
    validator.save_report(args.report)
    
    # Return exit code
    return 0 if len(validator.issues) == 0 else 1

if __name__ == '__main__':
    sys.exit(main())