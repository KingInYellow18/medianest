# MediaNest Documentation Quality Assurance

Comprehensive quality assurance suite for MediaNest documentation, ensuring enterprise-grade standards for links, formatting, accessibility, mobile responsiveness, and performance.

## 🎯 Overview

This QA suite provides:

- **🔗 Link Validation**: Comprehensive checking of internal and external links
- **📋 Formatting Validation**: Markdown consistency and MkDocs compliance
- **♿ Accessibility Testing**: WCAG 2.1 compliance and inclusive design
- **📱 Mobile Responsiveness**: Cross-device compatibility testing
- **⚡ Performance Monitoring**: Build time, page load, and resource optimization
- **📊 Quality Dashboard**: Visual metrics and actionable recommendations

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- MkDocs with Material theme
- Chrome/Chromium (for mobile and performance testing)

### Run Complete QA Suite

```bash
# Run comprehensive QA with automated setup
./tests/docs-qa/run_qa.sh

# Or run with Python directly
cd tests/docs-qa
python3 quality_dashboard.py
```

### Run Individual Modules

```bash
# Link checking only
python3 tests/docs-qa/comprehensive_link_checker.py

# Formatting validation only
python3 tests/docs-qa/formatting_validator.py

# Accessibility testing only
python3 tests/docs-qa/accessibility_tester.py

# Mobile responsiveness (requires running site)
python3 tests/docs-qa/mobile_responsiveness_tester.py

# Performance monitoring (requires running site)
python3 tests/docs-qa/performance_monitor.py
```

## 📊 Quality Dashboard

The comprehensive dashboard provides:

### Visual Metrics

- Overall quality score (0-100)
- Individual module scores
- Quality gate status
- Issue distribution and trends

### Quality Gates

- **Overall Score**: ≥85/100
- **Link Success Rate**: ≥95%
- **Formatting Quality**: ≥90/100
- **Accessibility Score**: ≥85/100
- **Mobile Friendliness**: ≥80/100
- **Performance Score**: ≥75/100
- **Critical Issues**: 0
- **Total Issues**: <50

### Outputs

- `quality_dashboard.html`: Interactive web dashboard
- `comprehensive_qa_report.json`: Detailed JSON report
- Individual module reports in JSON format
- CI-friendly markdown report

## 🔧 Configuration

### Environment Variables

```bash
export DOCS_DIR="docs"                    # Documentation directory
export SITE_URL="http://localhost:8000"   # Site URL for testing
export QA_TIMEOUT="300"                   # Timeout for tests (seconds)
```

### Quality Thresholds

Edit `quality_dashboard.py` to customize quality gates:

```python
self.quality_gates = {
    'overall_score': 85.0,
    'link_check_score': 95.0,
    'formatting_score': 90.0,
    'accessibility_score': 85.0,
    'mobile_score': 80.0,
    'performance_score': 75.0,
    'critical_issues': 0,
    'total_issues': 50
}
```

## 📋 Module Details

### 🔗 Link Validation (`comprehensive_link_checker.py`)

**Features:**

- Internal and external link validation
- Anchor checking in markdown files
- Broken link detection and reporting
- Performance metrics for link checking
- Caching for external links to improve speed

**Checks:**

- File existence for internal links
- HTTP status codes for external links
- Anchor existence in target files
- Redirect chain analysis
- Response time monitoring

**Output:**

```json
{
  "summary": {
    "total_links": 150,
    "valid_links": 147,
    "invalid_links": 3,
    "success_rate": 98.0
  },
  "broken_links": [...],
  "recommendations": [...]
}
```

### 📋 Formatting Validation (`formatting_validator.py`)

**Features:**

- Markdown syntax validation
- Style consistency checking
- MkDocs configuration validation
- Navigation structure verification
- Frontmatter validation

**Checks:**

- Heading hierarchy (H1 → H2 → H3)
- List marker consistency
- Code fence style consistency
- Line length limits
- Trailing whitespace
- Link text quality
- Table formatting
- YAML frontmatter structure

**Output:**

```json
{
  "summary": {
    "total_issues": 12,
    "errors": 0,
    "warnings": 8,
    "info": 4,
    "quality_score": 92.1
  },
  "detailed_issues": [...],
  "recommendations": [...]
}
```

### ♿ Accessibility Testing (`accessibility_tester.py`)

**Features:**

- WCAG 2.1 compliance testing
- Screen reader compatibility
- Color contrast validation
- Keyboard navigation testing
- Semantic markup validation

**Checks:**

- Alt text for images
- Heading hierarchy and structure
- Link purpose and context
- Form labels and accessibility
- Table headers and structure
- Language identification
- Document structure
- Interactive element accessibility

**Output:**

```json
{
  "summary": {
    "accessibility_score": 88.5,
    "wcag_compliance": {
      "A": true,
      "AA": false,
      "AAA": false
    },
    "critical_issues": 2
  },
  "detailed_issues": [...],
  "recommendations": [...]
}
```

### 📱 Mobile Responsiveness (`mobile_responsiveness_tester.py`)

**Features:**

- Multi-device testing
- Touch target validation
- Viewport configuration checking
- Content readability testing
- Navigation usability assessment

**Device Configurations:**

- Mobile Small (320x568)
- Mobile Medium (375x667)
- Mobile Large (414x896)
- Tablet Portrait (768x1024)
- Tablet Landscape (1024x768)
- Desktop Small (1280x720)

**Checks:**

- Viewport meta tag configuration
- Touch target sizes (≥44px)
- Content overflow and horizontal scrolling
- Font sizes for readability
- Navigation accessibility on mobile
- Form input optimization
- Image scaling and responsiveness

**Output:**

```json
{
  "summary": {
    "responsiveness_score": 82.3,
    "device_compatibility": {
      "mobile_small": "good",
      "tablet_portrait": "excellent"
    },
    "critical_issues": 1
  },
  "detailed_issues": [...],
  "recommendations": [...]
}
```

### ⚡ Performance Monitoring (`performance_monitor.py`)

**Features:**

- Build performance analysis
- Page load time monitoring
- Resource optimization checking
- Core Web Vitals measurement
- Search performance testing

**Metrics:**

- Build time and resource usage
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)
- Bundle size analysis
- Image optimization assessment
- Compression and caching analysis

**Output:**

```json
{
  "summary": {
    "performance_score": 78.9,
    "build_time": 12.3,
    "lighthouse_scores": {
      "performance": 89,
      "accessibility": 92
    }
  },
  "detailed_metrics": [...],
  "recommendations": [...]
}
```

## 🏗️ CI/CD Integration

### GitHub Actions

```yaml
name: Documentation QA
on: [push, pull_request]

jobs:
  docs-qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v3
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          pip install mkdocs-material
          ./tests/docs-qa/run_qa.sh --install-deps

      - name: Run Documentation QA
        run: |
          ./tests/docs-qa/run_qa.sh --ci

      - name: Upload QA Report
        uses: actions/upload-artifact@v3
        with:
          name: qa-report
          path: tests/docs-qa/results/
```

### GitLab CI

```yaml
docs-qa:
  stage: test
  image: python:3.9
  before_script:
    - pip install mkdocs-material
    - ./tests/docs-qa/run_qa.sh --install-deps
  script:
    - ./tests/docs-qa/run_qa.sh --ci
  artifacts:
    reports:
      junit: tests/docs-qa/results/junit.xml
    paths:
      - tests/docs-qa/results/
```

## 🎛️ Command Line Options

### Main Runner (`run_qa.sh`)

```bash
# Basic usage
./tests/docs-qa/run_qa.sh [OPTIONS]

# Options
--comprehensive              # Run comprehensive QA (default)
--individual                # Run individual modules separately
--install-deps              # Install Python dependencies only
--start-server              # Start MkDocs server only
--skip MODULE               # Skip specific modules
--site-url URL              # Documentation site URL
--docs-dir DIR              # Documentation directory
--ci                        # Generate CI-friendly output
--help                      # Show help message

# Examples
./tests/docs-qa/run_qa.sh --skip mobile --skip performance
./tests/docs-qa/run_qa.sh --ci --site-url http://staging.docs.com
./tests/docs-qa/run_qa.sh --individual
```

### Quality Dashboard (`quality_dashboard.py`)

```bash
python3 quality_dashboard.py [OPTIONS]

# Options
--skip MODULE               # Skip specific QA modules
--site-url URL              # URL of documentation site
--docs-dir DIR              # Documentation directory
--ci                        # Generate CI-friendly output
```

## 📈 Metrics and Scoring

### Overall Quality Score Calculation

```
Overall Score = (
  Link Score × 0.25 +
  Formatting Score × 0.20 +
  Accessibility Score × 0.25 +
  Mobile Score × 0.15 +
  Performance Score × 0.15
)
```

### Score Ranges

- **90-100**: Excellent ✅
- **75-89**: Good 👍
- **60-74**: Warning ⚠️
- **0-59**: Poor ❌

### Quality Gates

Quality gates must ALL pass for deployment approval:

| Gate            | Threshold | Description                 |
| --------------- | --------- | --------------------------- |
| Overall Score   | ≥85       | Combined quality score      |
| Link Success    | ≥95%      | Valid links percentage      |
| Formatting      | ≥90       | Markdown quality score      |
| Accessibility   | ≥85       | WCAG compliance score       |
| Mobile          | ≥80       | Mobile friendliness         |
| Performance     | ≥75       | Page speed and optimization |
| Critical Issues | 0         | No critical issues allowed  |
| Total Issues    | <50       | Keep issue count manageable |

## 🔍 Troubleshooting

### Common Issues

**MkDocs server won't start:**

```bash
# Check if port is in use
lsof -i :8000

# Start with different port
mkdocs serve --dev-addr=localhost:8001
```

**Chrome/Selenium issues:**

```bash
# Install Chrome on Ubuntu
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update && sudo apt install google-chrome-stable

# Install ChromeDriver
pip install webdriver-manager
```

**Python dependency errors:**

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r tests/docs-qa/requirements.txt
```

### Performance Issues

**Large documentation sets:**

- Use `--skip` to exclude heavy modules
- Run individual modules separately
- Implement parallel processing for link checking

**Network timeouts:**

- Increase timeout values in configuration
- Skip external link checking for offline testing
- Use cached results when available

## 📚 Best Practices

### Documentation Quality

1. **Link Management**
   - Use relative links for internal content
   - Regularly audit external links
   - Implement link checking in CI/CD

2. **Formatting Standards**
   - Maintain consistent heading hierarchy
   - Use standard markdown syntax
   - Include descriptive frontmatter

3. **Accessibility**
   - Provide alt text for all images
   - Use semantic HTML structure
   - Ensure proper color contrast

4. **Mobile Optimization**
   - Test on multiple device sizes
   - Optimize touch targets
   - Ensure readable font sizes

5. **Performance**
   - Optimize images and assets
   - Implement compression
   - Monitor build times

### QA Integration

1. **Development Workflow**
   - Run QA checks before commits
   - Include QA in pull request process
   - Monitor quality trends over time

2. **Team Practices**
   - Train team on quality standards
   - Regular quality reviews
   - Document quality guidelines

3. **Continuous Improvement**
   - Adjust thresholds based on project needs
   - Add new quality checks as needed
   - Monitor and optimize QA performance

## 🤝 Contributing

To add new QA modules:

1. Create module in `tests/docs-qa/`
2. Follow existing patterns for error reporting
3. Add integration to `quality_dashboard.py`
4. Update documentation and tests
5. Submit pull request with examples

## 📄 License

This QA suite is part of the MediaNest project and follows the same licensing terms.
