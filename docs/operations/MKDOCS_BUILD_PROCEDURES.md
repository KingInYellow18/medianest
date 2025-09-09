# MKdocs Build Procedures 🔧

## Quick Start Commands

### Setup Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install mkdocs-material mkdocs-minify-plugin mkdocs-git-revision-date-localized-plugin
```

### Production Build
```bash
source venv/bin/activate
mkdocs build -f mkdocs-production.yml --clean
```

### Development Server
```bash
source venv/bin/activate
mkdocs serve -f mkdocs-production.yml
```

### Strict Mode Testing
```bash
source venv/bin/activate
mkdocs build -f mkdocs-production.yml --strict --verbose
```

## Configuration Files

- **`mkdocs-production.yml`**: Production-ready configuration with available plugins
- **`mkdocs-test.yml`**: Simplified testing configuration  
- **`mkdocs.yml`**: Original configuration (contains unavailable plugins)

## Build Validation Checklist

- [ ] Virtual environment activated
- [ ] All required plugins installed
- [ ] Build completes without errors
- [ ] Search functionality working
- [ ] All navigation links functional
- [ ] Assets (CSS/JS/images) loading correctly
- [ ] Mobile responsive design working
- [ ] Site size reasonable (< 50MB)

## Common Issues & Solutions

### Plugin Not Found
- **Solution**: Use `mkdocs-production.yml` which only includes available plugins

### Build Warnings
- **Git revision warnings**: Normal for uncommitted files, will disappear after commit
- **README.md conflict**: Excluded automatically, not an issue

### Performance Issues
- **Large search index**: Normal for comprehensive documentation
- **Build time**: 30-40 seconds is normal for 266 pages

## Production Deployment

1. Use `mkdocs-production.yml` configuration
2. Build with `--clean` flag for fresh deployment
3. Deploy `site/` directory contents to web server
4. Ensure proper MIME types configured for CSS/JS files

---
**Last Updated**: 2025-09-09  
**Tested Configuration**: mkdocs-production.yml  
**Verified Pages**: 266  
**Status**: READY FOR PRODUCTION ✅