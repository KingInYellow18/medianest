#!/usr/bin/env python3
"""
Spell checking script for MediaNest documentation.
Uses aspell/hunspell for spell checking with custom dictionary support.
"""

import os
import re
import sys
import json
import subprocess
from pathlib import Path
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class SpellChecker:
    def __init__(self, docs_dir, dictionary_file=None):
        self.docs_dir = Path(docs_dir)
        self.dictionary_file = dictionary_file
        self.issues = []
        self.custom_words = self._load_custom_dictionary()
        
        # Technical terms and project-specific words to ignore
        self.default_ignore = {
            # Technical terms
            'api', 'apis', 'cli', 'gui', 'url', 'urls', 'json', 'xml', 'yaml', 'yml',
            'html', 'css', 'javascript', 'js', 'npm', 'nodejs', 'python', 'pip',
            'docker', 'dockerfile', 'kubernetes', 'k8s', 'postgres', 'postgresql',
            'redis', 'nginx', 'apache', 'ssl', 'tls', 'https', 'http', 'tcp', 'udp',
            'ssh', 'ftp', 'smtp', 'cors', 'jwt', 'oauth', 'uuid', 'guid',
            
            # MediaNest specific
            'medianest', 'mkdocs', 'plex', 'ffmpeg', 'metadata', 'transcode',
            'transcoding', 'webhook', 'webhooks', 'backend', 'frontend',
            
            # Common programming terms
            'config', 'configs', 'init', 'async', 'await', 'bool', 'boolean',
            'str', 'string', 'int', 'integer', 'float', 'dict', 'list', 'tuple',
            'regex', 'auth', 'login', 'logout', 'signup', 'username', 'password',
            'admin', 'sudo', 'chmod', 'chown', 'mkdir', 'rmdir', 'symlink',
            
            # File extensions
            'md', 'txt', 'log', 'conf', 'cfg', 'ini', 'env', 'gitignore',
            'dockerfile', 'dockerignore', 'makefile', 'readme', 'changelog',
            
            # Common abbreviations
            'etc', 'api', 'ui', 'ux', 'db', 'www', 'cdn', 'dns', 'ip',
            'cpu', 'gpu', 'ram', 'ssd', 'hdd', 'os', 'vm', 'vps',
            
            # Version/format numbers
            'v1', 'v2', 'v3', '2fa', '3d', '4k', '8k'
        }
    
    def _load_custom_dictionary(self):
        """Load custom dictionary words."""
        custom_words = set()
        
        if self.dictionary_file and os.path.exists(self.dictionary_file):
            with open(self.dictionary_file, 'r') as f:
                for line in f:
                    word = line.strip().lower()
                    if word and not word.startswith('#'):
                        custom_words.add(word)
        
        # Try to load .spellcheck-ignore file
        ignore_file = self.docs_dir / '.spellcheck-ignore'
        if ignore_file.exists():
            with open(ignore_file, 'r') as f:
                for line in f:
                    word = line.strip().lower()
                    if word and not word.startswith('#'):
                        custom_words.add(word)
        
        return custom_words
    
    def _is_spellchecker_available(self):
        """Check if aspell or hunspell is available."""
        for cmd in ['aspell', 'hunspell']:
            try:
                subprocess.run([cmd, '--version'], 
                             stdout=subprocess.DEVNULL, 
                             stderr=subprocess.DEVNULL,
                             check=True)
                return cmd
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        return None
    
    def _extract_text_from_markdown(self, content):
        """Extract text from markdown, removing code blocks and links."""
        # Remove code blocks
        content = re.sub(r'```[\s\S]*?```', '', content)
        content = re.sub(r'`[^`]+`', '', content)
        
        # Remove links but keep link text
        content = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content)
        
        # Remove image references
        content = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', content)
        
        # Remove HTML tags
        content = re.sub(r'<[^>]+>', '', content)
        
        # Remove markdown formatting
        content = re.sub(r'[#*_~`]', '', content)
        
        # Remove URLs
        content = re.sub(r'https?://[^\s]+', '', content)
        
        # Remove email addresses
        content = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', content)
        
        return content
    
    def _check_word_with_spellchecker(self, word, spellchecker):
        """Check a word using external spellchecker."""
        try:
            result = subprocess.run(
                [spellchecker, '-l'],
                input=word,
                text=True,
                capture_output=True
            )
            return len(result.stdout.strip()) == 0
        except Exception:
            return True  # Assume correct if we can't check
    
    def _is_likely_correct(self, word):
        """Check if a word is likely correct using heuristics."""
        word_lower = word.lower()
        
        # Check default ignore list
        if word_lower in self.default_ignore:
            return True
        
        # Check custom dictionary
        if word_lower in self.custom_words:
            return True
        
        # Skip very short words
        if len(word) <= 2:
            return True
        
        # Skip words that are all uppercase (likely acronyms)
        if word.isupper() and len(word) >= 2:
            return True
        
        # Skip words with numbers
        if any(c.isdigit() for c in word):
            return True
        
        # Skip words with special characters (likely code/config)
        if any(c in word for c in '.-_/\\'):
            return True
        
        # Skip camelCase/PascalCase (likely identifiers)
        if re.match(r'^[a-z]+[A-Z][a-zA-Z]*$', word) or re.match(r'^[A-Z][a-z]+[A-Z][a-zA-Z]*$', word):
            return True
        
        return False
    
    def check_file(self, md_file):
        """Check spelling in a markdown file."""
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
        
        # Extract text content
        text_content = self._extract_text_from_markdown(content)
        
        # Get spellchecker command
        spellchecker = self._is_spellchecker_available()
        
        # Extract words
        words = re.findall(r'\b[A-Za-z]+\b', text_content)
        
        line_number = 1
        checked_words = set()
        
        for line in content.split('\n'):
            # Skip code blocks and inline code
            if '```' in line or line.strip().startswith('    '):
                line_number += 1
                continue
            
            line_text = self._extract_text_from_markdown(line)
            line_words = re.findall(r'\b[A-Za-z]+\b', line_text)
            
            for word in line_words:
                word_key = (word.lower(), str(md_file))
                if word_key in checked_words:
                    continue
                checked_words.add(word_key)
                
                if not self._is_likely_correct(word):
                    # Use external spellchecker if available
                    if spellchecker and not self._check_word_with_spellchecker(word, spellchecker):
                        self.issues.append({
                            'file': str(md_file),
                            'line': line_number,
                            'word': word,
                            'type': 'misspelling',
                            'message': f'Possible misspelling: "{word}"'
                        })
            
            line_number += 1
    
    def check_all_files(self, file_paths=None):
        """Check spelling in all markdown files."""
        if file_paths:
            md_files = [Path(f) for f in file_paths if f.endswith('.md')]
        else:
            md_files = list(self.docs_dir.rglob('*.md'))
        
        logger.info(f"Checking spelling in {len(md_files)} files")
        
        for md_file in md_files:
            if md_file.exists():
                self.check_file(md_file)
        
        return len(self.issues) == 0
    
    def generate_report(self):
        """Generate a spelling report."""
        if not self.issues:
            return "✅ No spelling issues found!"
        
        # Group by file
        files_with_issues = {}
        for issue in self.issues:
            file_path = issue['file']
            if file_path not in files_with_issues:
                files_with_issues[file_path] = []
            files_with_issues[file_path].append(issue)
        
        report = f"❌ Found {len(self.issues)} potential spelling issues in {len(files_with_issues)} files:\n\n"
        
        for file_path, file_issues in files_with_issues.items():
            report += f"## {file_path} ({len(file_issues)} issues)\n\n"
            
            for issue in file_issues:
                if issue['type'] == 'misspelling':
                    report += f"- Line {issue['line']}: **{issue['word']}**\n"
                else:
                    report += f"- {issue['message']}\n"
            
            report += "\n"
        
        report += "## How to fix\n\n"
        report += "1. Review each flagged word\n"
        report += "2. Fix actual misspellings\n"
        report += "3. Add valid technical terms to `.spellcheck-ignore` file\n"
        report += "4. Consider adding project-specific terms to the custom dictionary\n"
        
        return report
    
    def save_report(self, filename='spellcheck-report.json'):
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
    parser = argparse.ArgumentParser(description='Check spelling in documentation')
    parser.add_argument('docs_dir', nargs='?', default='docs', help='Path to the docs directory')
    parser.add_argument('--files', nargs='+', help='Specific files to check')
    parser.add_argument('--dictionary', help='Custom dictionary file')
    parser.add_argument('--report', help='Save report to JSON file', default='spellcheck-report.json')
    parser.add_argument('--quiet', action='store_true', help='Suppress info messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    if not os.path.exists(args.docs_dir):
        logger.error(f"Docs directory not found: {args.docs_dir}")
        return 1
    
    checker = SpellChecker(args.docs_dir, args.dictionary)
    
    # Check for spellchecker availability
    spellchecker = checker._is_spellchecker_available()
    if spellchecker:
        logger.info(f"Using {spellchecker} for spell checking")
    else:
        logger.warning("No external spellchecker found. Using basic heuristics only.")
        logger.info("Install aspell or hunspell for better spell checking:")
        logger.info("  Ubuntu/Debian: sudo apt install aspell aspell-en")
        logger.info("  macOS: brew install aspell")
    
    # Check spelling
    checker.check_all_files(args.files)
    
    # Print report
    print(checker.generate_report())
    
    # Save report
    checker.save_report(args.report)
    
    # Return exit code
    return 0 if len(checker.issues) == 0 else 1

if __name__ == '__main__':
    sys.exit(main())