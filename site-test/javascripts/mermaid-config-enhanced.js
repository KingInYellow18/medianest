// Mermaid Configuration for MediaNest Documentation
// Advanced configuration with theme support, performance optimization, and interactive features

(function () {
  'use strict';

  // Wait for DOM and Mermaid to be ready
  const initializeMermaid = () => {
    if (typeof mermaid === 'undefined') {
      console.warn('Mermaid not loaded, retrying in 100ms...');
      setTimeout(initializeMermaid, 100);
      return;
    }

    // Get current theme
    const getTheme = () => {
      const scheme = document.querySelector('[data-md-color-scheme]');
      return scheme && scheme.getAttribute('data-md-color-scheme') === 'slate' ? 'dark' : 'default';
    };

    // MediaNest brand colors with enhanced accessibility
    const colors = {
      primary: '#673ab7',
      primaryLight: '#9575cd',
      primaryDark: '#4527a0',
      secondary: '#ff4081',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336',
      info: '#2196f3',
      surface: '#ffffff',
      surfaceDark: '#303030',
      onSurface: '#000000',
      onSurfaceDark: '#ffffff',
      // Enhanced contrast colors
      highContrast: '#1a1a1a',
      lowContrast: '#757575',
      accent: '#e91e63',
    };

    // Theme configurations with improved accessibility
    const lightTheme = {
      theme: 'default',
      themeVariables: {
        // Primary colors
        primaryColor: colors.primary,
        primaryTextColor: colors.highContrast,
        primaryBorderColor: colors.primary,

        // Background colors
        background: colors.surface,
        secondaryColor: colors.primaryLight,
        tertiaryColor: '#f5f5f5',

        // Text colors with high contrast
        textColor: colors.highContrast,
        fontSize: '14px',
        fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',

        // Node colors
        mainBkg: colors.surface,
        secondBkg: colors.primaryLight,
        tertiaryBkg: '#e8eaf6',

        // Edge colors
        lineColor: colors.primaryDark,
        edgeLabelBackground: colors.surface,

        // Specific diagram colors
        actorBkg: colors.primaryLight,
        actorBorder: colors.primaryDark,
        actorTextColor: colors.highContrast,
        actorLineColor: colors.primaryDark,

        // Sequence diagram
        activationBkgColor: colors.primaryLight,
        activationBorderColor: colors.primaryDark,

        // Flowchart
        nodeBkg: colors.surface,
        nodeBorder: colors.primaryDark,

        // State diagram
        stateLabelColor: colors.highContrast,
        stateBkg: colors.surface,
        stateBorder: colors.primaryDark,

        // Class diagram
        classText: colors.highContrast,
        classBkg: colors.surface,
        classBorder: colors.primaryDark,

        // ER Diagram
        relationColor: colors.primaryDark,
        entityBkg: colors.surface,
        entityBorder: colors.primaryDark,

        // Git
        git0: colors.primary,
        git1: colors.secondary,
        git2: colors.success,
        git3: colors.warning,
        git4: colors.error,
        git5: colors.info,
        git6: colors.primaryLight,
        git7: colors.accent,
      },
    };

    const darkTheme = {
      theme: 'dark',
      themeVariables: {
        // Primary colors
        primaryColor: colors.primaryLight,
        primaryTextColor: colors.onSurfaceDark,
        primaryBorderColor: colors.primaryLight,

        // Background colors
        background: colors.surfaceDark,
        secondaryColor: colors.primary,
        tertiaryColor: '#424242',

        // Text colors
        textColor: colors.onSurfaceDark,
        fontSize: '14px',
        fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',

        // Node colors
        mainBkg: '#424242',
        secondBkg: colors.primary,
        tertiaryBkg: '#4527a0',

        // Edge colors
        lineColor: colors.primaryLight,
        edgeLabelBackground: colors.surfaceDark,

        // Specific diagram colors
        actorBkg: colors.primary,
        actorBorder: colors.primaryLight,
        actorTextColor: colors.onSurfaceDark,
        actorLineColor: colors.primaryLight,

        // Sequence diagram
        activationBkgColor: colors.primary,
        activationBorderColor: colors.primaryLight,

        // Flowchart
        nodeBkg: '#424242',
        nodeBorder: colors.primaryLight,

        // State diagram
        stateLabelColor: colors.onSurfaceDark,
        stateBkg: '#424242',
        stateBorder: colors.primaryLight,

        // Class diagram
        classText: colors.onSurfaceDark,
        classBkg: '#424242',
        classBorder: colors.primaryLight,

        // ER Diagram
        relationColor: colors.primaryLight,
        entityBkg: '#424242',
        entityBorder: colors.primaryLight,

        // Git
        git0: colors.primaryLight,
        git1: colors.secondary,
        git2: colors.success,
        git3: colors.warning,
        git4: colors.error,
        git5: colors.info,
        git6: colors.primary,
        git7: colors.accent,
      },
    };

    // Enhanced base configuration
    const baseConfig = {
      // Security
      securityLevel: 'loose',

      // Performance optimization
      startOnLoad: true,
      maxTextSize: 90000,
      maxEdges: 1000,
      suppressErrorRendering: false,

      // Accessibility
      fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
      altFontFamily: '"Arial", sans-serif',

      // Enhanced diagram configurations
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 15,
        nodeSpacing: 60,
        rankSpacing: 60,
        diagramPadding: 12,
        wrappingWidth: 200,
        defaultRenderer: 'dagre-wrapper',
      },

      sequence: {
        useMaxWidth: true,
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        mirrorActors: true,
        bottomMarginAdj: 1,
        activationWidth: 10,
        rightAngles: false,
        showSequenceNumbers: false,
        wrap: true,
        wrapPadding: 10,
      },

      gantt: {
        useMaxWidth: true,
        leftPadding: 75,
        gridLineStartPadding: 35,
        fontSize: 11,
        fontFamily: '"Roboto", sans-serif',
        sectionFontSize: 24,
        numberSectionStyles: 4,
      },

      class: {
        useMaxWidth: true,
        defaultRenderer: 'dagre-wrapper',
        htmlLabels: false,
      },

      state: {
        useMaxWidth: true,
        defaultRenderer: 'dagre-wrapper',
      },

      journey: {
        useMaxWidth: true,
        diagramMarginX: 50,
        diagramMarginY: 10,
        leftMargin: 150,
        width: 150,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        bottomMarginAdj: 1,
        rightAngles: false,
      },

      er: {
        useMaxWidth: true,
        diagramPadding: 20,
        layoutDirection: 'TB',
        minEntityWidth: 100,
        minEntityHeight: 75,
        entityPadding: 15,
        stroke: 'gray',
        fill: 'honeydew',
        fontSize: 12,
      },

      pie: {
        useMaxWidth: true,
        textPosition: 0.75,
        legendPosition: 'bottom',
      },

      gitGraph: {
        useMaxWidth: true,
        diagramPadding: 8,
        nodeLabel: {
          width: 75,
          height: 100,
          x: -25,
          y: -8,
        },
      },

      // Timeline configuration
      timeline: {
        useMaxWidth: true,
        diagramMarginX: 50,
        diagramMarginY: 10,
        leftMargin: 150,
        width: 150,
        height: 50,
        padding: 5,
      },
    };

    // Initialize Mermaid with current theme
    const initWithTheme = (themeName) => {
      const config = Object.assign({}, baseConfig, themeName === 'dark' ? darkTheme : lightTheme);

      try {
        mermaid.initialize(config);
        console.log(`Mermaid initialized with ${themeName} theme`);

        // Add accessibility enhancements
        setTimeout(() => {
          addAccessibilityFeatures();
        }, 500);
      } catch (error) {
        console.error('Error initializing Mermaid:', error);
      }
    };

    // Add accessibility features to diagrams
    const addAccessibilityFeatures = () => {
      const diagrams = document.querySelectorAll('.mermaid svg');

      diagrams.forEach((svg, index) => {
        // Add ARIA labels
        if (!svg.getAttribute('aria-label')) {
          const title =
            svg.querySelector('title')?.textContent ||
            svg.closest('[data-diagram-type]')?.getAttribute('data-diagram-type') ||
            `Diagram ${index + 1}`;
          svg.setAttribute('aria-label', `Interactive diagram: ${title}`);
        }

        // Add role
        svg.setAttribute('role', 'img');

        // Add focusable elements
        svg.setAttribute('tabindex', '0');

        // Add keyboard navigation
        svg.addEventListener('keydown', handleDiagramKeyboard);

        // Add click interactions for better UX
        const clickableElements = svg.querySelectorAll('g[class*="node"], rect[class*="actor"]');
        clickableElements.forEach((element) => {
          element.style.cursor = 'pointer';
          element.setAttribute('tabindex', '0');

          // Add hover effects
          element.addEventListener('mouseenter', (e) => {
            e.target.style.opacity = '0.8';
          });

          element.addEventListener('mouseleave', (e) => {
            e.target.style.opacity = '1';
          });
        });
      });
    };

    // Keyboard navigation for diagrams
    const handleDiagramKeyboard = (event) => {
      const svg = event.target;
      const focusableElements = svg.querySelectorAll('[tabindex="0"]');
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          const nextIndex = (currentIndex + 1) % focusableElements.length;
          focusableElements[nextIndex]?.focus();
          break;

        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
          focusableElements[prevIndex]?.focus();
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          // Trigger click on focused element
          document.activeElement.click();
          break;
      }
    };

    // Initial setup
    const currentTheme = getTheme();
    initWithTheme(currentTheme);

    // Export enhanced API for debugging and external use
    window.MediaNestMermaid = {
      colors,
      lightTheme,
      darkTheme,
      baseConfig,
      getTheme,
      addAccessibilityFeatures,
      version: '2.0.0',
    };

    console.log('MediaNest Enhanced Mermaid configuration loaded successfully v2.0.0');
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMermaid);
  } else {
    initializeMermaid();
  }
})();
