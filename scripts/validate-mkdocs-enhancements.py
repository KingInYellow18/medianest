#!/usr/bin/env python3
"""
MediaNest Documentation - MkDocs Enhancement Validation Script
Validates the enhanced MkDocs configuration and components
"""

import os
import sys
import yaml
import json
from pathlib import Path

class MkDocsValidator:
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.docs_dir = self.project_root / 'docs'
        self.config_file = self.project_root / 'mkdocs.yml'
        self.errors = []
        self.warnings = []
        self.info = []

    def log_error(self, message):
        self.errors.append(f"❌ ERROR: {message}")
        print(f"❌ ERROR: {message}")

    def log_warning(self, message):
        self.warnings.append(f"⚠️  WARNING: {message}")
        print(f"⚠️  WARNING: {message}")

    def log_info(self, message):
        self.info.append(f"ℹ️  INFO: {message}")
        print(f"ℹ️  INFO: {message}")

    def validate_config_file(self):
        """Validate the mkdocs.yml configuration file."""
        self.log_info("Validating mkdocs.yml configuration...")
        
        if not self.config_file.exists():
            self.log_error(f"mkdocs.yml not found at {self.config_file}")
            return False

        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
        except yaml.YAMLError as e:
            self.log_error(f"Invalid YAML in mkdocs.yml: {e}")
            return False
        except Exception as e:
            self.log_error(f"Error reading mkdocs.yml: {e}")
            return False

        # Validate required fields
        required_fields = ['site_name', 'site_url', 'theme', 'nav']
        for field in required_fields:
            if field not in config:
                self.log_error(f"Missing required field: {field}")

        # Validate theme configuration
        if 'theme' in config:
            theme = config['theme']
            if theme.get('name') != 'material':
                self.log_warning("Theme is not 'material' - enhanced features may not work")
            
            # Check for enhanced features
            features = theme.get('features', [])
            expected_features = [
                'navigation.instant',
                'navigation.tracking',
                'search.suggest',
                'search.highlight',
                'content.code.copy'
            ]
            
            for feature in expected_features:
                if feature not in features:
                    self.log_warning(f"Recommended feature missing: {feature}")

        # Validate plugins
        if 'plugins' in config:
            plugins = config['plugins']
            plugin_names = []
            
            for plugin in plugins:
                if isinstance(plugin, dict):
                    plugin_names.extend(plugin.keys())
                elif isinstance(plugin, str):
                    plugin_names.append(plugin)
            
            # Check for enhanced plugins
            recommended_plugins = ['search', 'tags', 'social']
            for plugin in recommended_plugins:
                if plugin not in plugin_names:
                    self.log_info(f"Consider adding plugin: {plugin}")

        # Validate extra_css and extra_javascript
        if 'extra_css' in config:
            for css_file in config['extra_css']:
                css_path = self.docs_dir / css_file
                if not css_path.exists():
                    self.log_warning(f"CSS file not found: {css_file}")

        if 'extra_javascript' in config:
            for js_file in config['extra_javascript']:
                # Skip external URLs
                if js_file.startswith('http'):
                    continue
                js_path = self.docs_dir / js_file
                if not js_path.exists():
                    self.log_warning(f"JavaScript file not found: {js_file}")

        self.log_info("mkdocs.yml validation completed")
        return len(self.errors) == 0

    def validate_docs_structure(self):
        """Validate the docs directory structure."""
        self.log_info("Validating docs directory structure...")
        
        if not self.docs_dir.exists():
            self.log_error(f"Docs directory not found: {self.docs_dir}")
            return False

        # Check for required files
        required_files = ['index.md']
        for file in required_files:
            file_path = self.docs_dir / file
            if not file_path.exists():
                self.log_error(f"Required file missing: {file}")

        # Check for enhanced directories
        enhanced_dirs = ['stylesheets', 'javascripts']
        for dir_name in enhanced_dirs:
            dir_path = self.docs_dir / dir_name
            if not dir_path.exists():
                self.log_warning(f"Enhanced directory missing: {dir_name}")

        self.log_info("Docs structure validation completed")
        return True

    def validate_css_files(self):
        """Validate CSS files for syntax and completeness."""
        self.log_info("Validating CSS files...")
        
        css_dir = self.docs_dir / 'stylesheets'
        if not css_dir.exists():
            self.log_warning("Stylesheets directory not found")
            return True

        required_css = [
            'extra.css',
            'medianest-theme.css',
            'material-enhancements.css'
        ]

        for css_file in required_css:
            css_path = css_dir / css_file
            if not css_path.exists():
                self.log_warning(f"CSS file missing: {css_file}")
                continue

            try:
                with open(css_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Basic CSS validation
                if not content.strip():
                    self.log_warning(f"CSS file is empty: {css_file}")
                    continue
                    
                # Check for CSS custom properties (CSS variables)
                if css_file == 'material-enhancements.css':
                    if '--md3-primary' not in content:
                        self.log_warning("Material Design 3 variables not found in material-enhancements.css")
                
                self.log_info(f"CSS file validated: {css_file}")
                
            except Exception as e:
                self.log_error(f"Error reading CSS file {css_file}: {e}")

        return True

    def validate_javascript_files(self):
        """Validate JavaScript files for syntax and completeness."""
        self.log_info("Validating JavaScript files...")
        
        js_dir = self.docs_dir / 'javascripts'
        if not js_dir.exists():
            self.log_warning("Javascripts directory not found")
            return True

        required_js = [
            'extra.js',
            'medianest.js',
            'search-enhancements.js',
            'api-explorer.js'
        ]

        for js_file in required_js:
            js_path = js_dir / js_file
            if not js_path.exists():
                self.log_warning(f"JavaScript file missing: {js_file}")
                continue

            try:
                with open(js_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Basic JavaScript validation
                if not content.strip():
                    self.log_warning(f"JavaScript file is empty: {js_file}")
                    continue
                    
                # Check for basic JavaScript patterns
                if 'function' not in content and 'class' not in content and '=>' not in content:
                    self.log_warning(f"JavaScript file may not contain valid code: {js_file}")
                
                # Check for MediaNest-specific patterns
                if js_file == 'medianest.js':
                    if 'MediaNestDocs' not in content:
                        self.log_warning("MediaNestDocs object not found in medianest.js")
                
                self.log_info(f"JavaScript file validated: {js_file}")
                
            except Exception as e:
                self.log_error(f"Error reading JavaScript file {js_file}: {e}")

        return True

    def validate_navigation(self):
        """Validate navigation structure and links."""
        self.log_info("Validating navigation structure...")
        
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
        except:
            self.log_error("Could not load config for navigation validation")
            return False

        if 'nav' not in config:
            self.log_error("No navigation configuration found")
            return False

        nav = config['nav']
        self._validate_nav_items(nav, '')

        return True

    def _validate_nav_items(self, nav_items, prefix):
        """Recursively validate navigation items."""
        for item in nav_items:
            if isinstance(item, str):
                # Simple markdown file
                file_path = self.docs_dir / item
                if not file_path.exists():
                    self.log_warning(f"Navigation file not found: {prefix}{item}")
            elif isinstance(item, dict):
                for title, content in item.items():
                    if isinstance(content, str):
                        # Single file
                        file_path = self.docs_dir / content
                        if not file_path.exists():
                            self.log_warning(f"Navigation file not found: {prefix}{content}")
                    elif isinstance(content, list):
                        # Nested navigation
                        self._validate_nav_items(content, f"{prefix}{title}/")

    def validate_tags(self):
        """Validate tags configuration and tags.md file."""
        self.log_info("Validating tags configuration...")
        
        tags_file = self.docs_dir / 'tags.md'
        if not tags_file.exists():
            self.log_warning("tags.md file not found - enhanced tagging may not work")
            return True

        try:
            with open(tags_file, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'Available Tags' not in content:
                    self.log_warning("tags.md appears to be incomplete")
        except Exception as e:
            self.log_error(f"Error reading tags.md: {e}")

        return True

    def validate_enhanced_features(self):
        """Validate enhanced documentation features."""
        self.log_info("Validating enhanced features...")
        
        # Check for Material Design 3 components in index.md
        index_file = self.docs_dir / 'index.md'
        if index_file.exists():
            try:
                with open(index_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                md3_components = ['md3-card', 'md3-button', 'md3-chip']
                for component in md3_components:
                    if component in content:
                        self.log_info(f"Found Material Design 3 component: {component}")
                    else:
                        self.log_info(f"Material Design 3 component not found: {component}")
                        
                # Check for API explorer integration
                if 'data-api-endpoint' in content:
                    self.log_info("API explorer integration found")
                else:
                    self.log_info("API explorer integration not found")
                    
                # Check for enhanced search
                if 'md3-search-bar' in content:
                    self.log_info("Enhanced search component found")
                else:
                    self.log_info("Enhanced search component not found")
                    
            except Exception as e:
                self.log_error(f"Error reading index.md: {e}")

        return True

    def generate_report(self):
        """Generate a validation report."""
        print("\n" + "="*60)
        print("📊 MKDOCS ENHANCEMENT VALIDATION REPORT")
        print("="*60)
        
        print(f"\n📁 Project: {self.project_root}")
        print(f"📄 Config: {self.config_file}")
        print(f"📚 Docs: {self.docs_dir}")
        
        print(f"\n📈 SUMMARY:")
        print(f"  • Errors: {len(self.errors)}")
        print(f"  • Warnings: {len(self.warnings)}")
        print(f"  • Info: {len(self.info)}")
        
        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  {error}")
        
        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  {warning}")
        
        print(f"\n🎯 RECOMMENDATIONS:")
        if len(self.errors) == 0:
            print("  • Configuration appears valid ✅")
        else:
            print("  • Fix errors before building documentation")
            
        if len(self.warnings) > 0:
            print("  • Address warnings for optimal functionality")
        else:
            print("  • No warnings - excellent configuration! ✅")
            
        print("\n🚀 NEXT STEPS:")
        print("  1. Run 'mkdocs build' to test the build")
        print("  2. Run 'mkdocs serve' to preview locally")
        print("  3. Deploy to GitHub Pages or hosting platform")
        
        return len(self.errors) == 0

    def run_validation(self):
        """Run all validation checks."""
        print("🔍 Starting MkDocs Enhancement Validation...")
        print(f"📁 Project Root: {self.project_root}")
        
        success = True
        
        # Run all validation checks
        checks = [
            ("Configuration File", self.validate_config_file),
            ("Docs Structure", self.validate_docs_structure),
            ("CSS Files", self.validate_css_files),
            ("JavaScript Files", self.validate_javascript_files),
            ("Navigation", self.validate_navigation),
            ("Tags", self.validate_tags),
            ("Enhanced Features", self.validate_enhanced_features)
        ]
        
        for check_name, check_func in checks:
            print(f"\n🔍 Running {check_name} validation...")
            try:
                result = check_func()
                if not result:
                    success = False
            except Exception as e:
                self.log_error(f"Validation check '{check_name}' failed: {e}")
                success = False
        
        # Generate final report
        final_success = self.generate_report()
        
        return final_success and success

def main():
    """Main validation function."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    validator = MkDocsValidator(project_root)
    success = validator.run_validation()
    
    if success:
        print("\n✅ All validations passed!")
        sys.exit(0)
    else:
        print("\n❌ Some validations failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()