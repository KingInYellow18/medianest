# Visual Testing Guide for MediaNest

## Overview

MediaNest uses comprehensive visual regression testing to ensure UI consistency and prevent visual bugs in production. Our enhanced visual testing infrastructure includes:

- **Storybook 9.x** - Component isolation and documentation with 18+ story files
- **Chromatic** - Cloud-based visual regression testing with automated CI/CD
- **Responsive Testing** - Multi-viewport validation (375px, 768px, 1024px, 1440px)
- **Accessibility Testing** - Automated a11y compliance with axe-core
- **Performance Monitoring** - Build time and bundle size tracking
- **Coverage Reporting** - Story coverage analysis with 80% minimum threshold

## Architecture

### Tools and Services

1. **Storybook 9.x** - Component development environment
2. **Chromatic** - Cloud-based visual testing platform
3. **GitHub Actions** - Automated CI/CD pipeline
4. **Accessibility Testing** - Automated a11y validation

### Coverage Areas

#### Critical Components

**Dashboard Components** (`src/components/dashboard/`)

- `ServiceCard` - Service status displays with multiple states
- `StatusIndicator` - Status icons with pulse animations
- `QuickActions` - Action buttons and interactions
- `ConnectionStatus` - Real-time connection indicators

**Media Components** (`src/components/media/`)

- `MediaCard` - Movie/TV show cards with posters
- `AvailabilityBadge` - Status badges for media availability
- `RequestModal` - Media request forms and validation
- `SearchInput` - Search interfaces with autocomplete

**YouTube Components** (`src/components/youtube/`)

- `DownloadQueue` - Progress indicators and queue management
- `URLSubmissionForm` - URL validation and submission
- `CollectionProgress` - Download progress tracking

## Getting Started

### Prerequisites

```bash
# Ensure Node.js 20+ is installed
node --version

# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### Running Storybook Locally

```bash
# Start Storybook development server
npm run storybook

# Build Storybook for production
npm run build-storybook
```

Access Storybook at `http://localhost:6006`

### Visual Testing Commands

```bash
# Run visual tests locally (requires Chromatic token)
npm run visual-test

# Run visual tests in CI mode
npm run visual-test:ci

# Build and test in one command
npm run build-storybook && npm run chromatic
```

## Writing Stories

### Story Structure

```typescript
// Component.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Component } from './Component';

const meta = {
  title: 'Category/Component',
  component: Component,
  parameters: {
    layout: 'centered',
    chromatic: {
      delay: 300,
      viewports: [375, 768, 1024, 1440],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // component props
  },
};
```

### Required Story Variants

For each component, create stories covering:

1. **Default State** - Normal appearance
2. **Loading State** - Loading indicators/skeletons
3. **Error State** - Error messages and failed states
4. **Empty State** - No data scenarios
5. **Responsive** - Mobile, tablet, desktop views
6. **Interactive States** - Hover, focus, active states
7. **Theme Variants** - Light and dark themes
8. **Edge Cases** - Long text, missing images, etc.

### Example: ServiceCard Stories

```typescript
export const PlexHealthy: Story = {
  args: {
    service: {
      status: 'up',
      name: 'Plex',
      responseTime: 45,
      uptime: 99.8,
    },
  },
};

export const PlexDegraded: Story = {
  args: {
    service: {
      status: 'degraded',
      name: 'Plex',
      responseTime: 1200,
      error: 'High response time detected',
    },
  },
};

export const MobileView: Story = {
  args: {
    /* ... */
  },
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    chromatic: { viewports: [375] },
  },
};
```

## Chromatic Configuration

### Project Settings

- **Project Token**: Stored as `CHROMATIC_PROJECT_TOKEN` secret
- **Auto-Accept**: Changes on main branch are auto-approved
- **Viewports**: 375px, 768px, 1024px, 1440px
- **Delay**: 300ms for animation stabilization

### Visual Review Process

1. **PR Creation** - Chromatic automatically builds and compares
2. **Change Detection** - Visual diffs are highlighted
3. **Review Required** - Team reviews changes in Chromatic UI
4. **Approval/Rejection** - Changes must be explicitly approved
5. **CI Passes** - Only after visual approval

### Chromatic Features Used

- **Baseline Management** - Automatic baseline updates
- **Focused Diffs** - Only test changed components
- **Cross-browser Testing** - Chrome, Firefox, Safari
- **Responsive Testing** - Multiple viewport sizes
- **Animation Handling** - Pause animations for consistency

## CI/CD Integration

### GitHub Actions Workflow

**Triggers:**

- Pull requests to main/develop
- Pushes to main branch
- Component file changes
- Story file changes
- Storybook configuration changes

**Checks:**

- TypeScript compilation
- ESLint validation
- Storybook build
- Chromatic visual tests
- Accessibility validation
- Component coverage

### Environment Variables

```bash
# Required for Chromatic
CHROMATIC_PROJECT_TOKEN=your_token_here

# Optional: Custom Storybook settings
STORYBOOK_THEME=dark
```

## Responsive Testing

### Viewport Configuration

```typescript
// .storybook/preview.ts
viewport: {
  viewports: {
    mobile: { width: '375px', height: '667px' },
    tablet: { width: '768px', height: '1024px' },
    desktop: { width: '1024px', height: '768px' },
    largeDesktop: { width: '1440px', height: '900px' },
  },
}
```

### Testing Strategy

1. **Mobile-First** - Start with smallest viewport
2. **Breakpoint Testing** - Test at major breakpoints
3. **Content Adaptation** - Ensure content scales properly
4. **Touch Targets** - Verify touch-friendly interactions
5. **Performance** - Optimize for mobile devices

## Accessibility Testing

### Automated A11y Checks

- **Color Contrast** - WCAG AA compliance
- **Keyboard Navigation** - Tab order and focus
- **Screen Reader** - ARIA labels and descriptions
- **Semantic HTML** - Proper element usage

### A11y Story Examples

```typescript
export const HighContrast: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'focus-order-semantics', enabled: true },
        ],
      },
    },
  },
};
```

## Performance Optimization

### Story Performance

1. **Lazy Loading** - Load heavy components on demand
2. **Mock Data** - Use lightweight mock data
3. **Asset Optimization** - Optimize images and icons
4. **Build Caching** - Cache Storybook builds

### Chromatic Optimization

```typescript
// Optimize visual tests
parameters: {
  chromatic: {
    delay: 300,           // Wait for animations
    pauseAnimationAtEnd: true,  // Consistent snapshots
    diffThreshold: 0.2,   // Sensitivity tuning
  },
}
```

## Troubleshooting

### Common Issues

**Storybook Build Failures**

```bash
# Clear cache and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build-storybook
```

**Visual Test Inconsistencies**

- Check animation timing
- Verify asset loading
- Review responsive breakpoints
- Validate theme configurations

**Coverage Warnings**

```bash
# Check missing stories
find src/components -name "*.tsx" -not -name "*.stories.tsx" | while read component; do
  story="${component%.tsx}.stories.tsx"
  [ ! -f "$story" ] && echo "Missing: $story"
done
```

### Debug Mode

```typescript
// Enable debug information
export const Debug: Story = {
  parameters: {
    chromatic: {
      delay: 1000,
      pauseAnimationAtEnd: true,
      debug: true,
    },
  },
};
```

## Quality Gates

### Minimum Requirements

- **Story Coverage**: 80% of components must have stories
- **Visual Approval**: All changes must be approved in Chromatic
- **A11y Compliance**: No accessibility violations
- **Responsive**: Components must work on all viewports
- **Performance**: Storybook builds under 30 seconds

### Review Checklist

- [ ] All component states covered
- [ ] Responsive design validated
- [ ] Dark/light themes tested
- [ ] Accessibility compliant
- [ ] Error states included
- [ ] Loading states shown
- [ ] Edge cases handled
- [ ] Documentation updated

## Best Practices

### Component Development

1. **Story-Driven Development** - Write stories before implementation
2. **Atomic Design** - Test components in isolation
3. **State Coverage** - Cover all possible component states
4. **Real Data** - Use realistic mock data
5. **Documentation** - Include usage examples

### Visual Testing

1. **Consistent Baselines** - Keep visual references up to date
2. **Meaningful Names** - Use descriptive story names
3. **Grouped Stories** - Organize by feature/category
4. **Performance** - Optimize for fast feedback loops
5. **Collaboration** - Use Chromatic for design reviews

### Team Workflow

1. **PR Reviews** - Review visual changes before merging
2. **Design System** - Maintain visual consistency
3. **Documentation** - Keep visual docs updated
4. **Training** - Ensure team understands tools
5. **Monitoring** - Track visual regression trends

## Additional Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Chromatic Documentation](https://www.chromatic.com/docs)
- [Visual Testing Best Practices](https://storybook.js.org/tutorials/visual-testing-handbook/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MediaNest Component Library](http://localhost:6006)

---

## Support

For visual testing issues:

1. Check this documentation
2. Review Chromatic build logs
3. Test locally with `npm run storybook`
4. Contact the development team
5. Create GitHub issue with screenshots
