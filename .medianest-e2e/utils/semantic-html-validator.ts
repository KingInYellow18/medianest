import { Page, Locator } from '@playwright/test';

/**
 * Semantic HTML Validator for MediaNest
 * Validates proper use of semantic HTML elements and document structure
 */

export class SemanticHtmlValidator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Validate complete semantic HTML structure
   */
  async validateSemanticStructure(): Promise<SemanticValidationResult> {
    const result: SemanticValidationResult = {
      documentStructure: await this.validateDocumentStructure(),
      headingHierarchy: await this.validateHeadingHierarchy(),
      landmarksUsage: await this.validateLandmarks(),
      formStructure: await this.validateFormStructure(),
      listStructure: await this.validateListStructure(),
      tableStructure: await this.validateTableStructure(),
      mediaElements: await this.validateMediaElements(),
      interactiveElements: await this.validateInteractiveElements(),
      overallScore: 0,
      recommendations: []
    };

    // Calculate overall score
    result.overallScore = this.calculateSemanticScore(result);
    
    // Generate recommendations
    result.recommendations = this.generateSemanticRecommendations(result);

    return result;
  }

  /**
   * Validate document structure (html, head, body)
   */
  private async validateDocumentStructure(): Promise<DocumentStructureResult> {
    const result: DocumentStructureResult = {
      hasValidDoctype: false,
      hasHtmlLang: false,
      hasTitle: false,
      hasMetaViewport: false,
      hasMetaDescription: false,
      violations: [],
      score: 0
    };

    // Check doctype
    const doctype = await this.page.evaluate(() => {
      const doctype = document.doctype;
      return doctype ? {
        name: doctype.name,
        publicId: doctype.publicId,
        systemId: doctype.systemId
      } : null;
    });

    if (doctype && doctype.name === 'html') {
      result.hasValidDoctype = true;
    } else {
      result.violations.push('Missing or invalid DOCTYPE declaration');
    }

    // Check html lang attribute
    const htmlLang = await this.page.locator('html').getAttribute('lang');
    if (htmlLang && htmlLang.trim()) {
      result.hasHtmlLang = true;
    } else {
      result.violations.push('Missing lang attribute on <html> element');
    }

    // Check title
    const title = await this.page.title();
    if (title && title.trim()) {
      result.hasTitle = true;
    } else {
      result.violations.push('Missing or empty <title> element');
    }

    // Check meta viewport
    const viewport = await this.page.locator('meta[name="viewport"]').count();
    if (viewport > 0) {
      result.hasMetaViewport = true;
    } else {
      result.violations.push('Missing viewport meta tag for responsive design');
    }

    // Check meta description
    const description = await this.page.locator('meta[name="description"]').count();
    if (description > 0) {
      result.hasMetaDescription = true;
    } else {
      result.violations.push('Missing meta description for SEO');
    }

    // Calculate score
    const totalChecks = 5;
    const passedChecks = [
      result.hasValidDoctype,
      result.hasHtmlLang,
      result.hasTitle,
      result.hasMetaViewport,
      result.hasMetaDescription
    ].filter(Boolean).length;

    result.score = Math.round((passedChecks / totalChecks) * 100);

    return result;
  }

  /**
   * Validate heading hierarchy
   */
  private async validateHeadingHierarchy(): Promise<HeadingHierarchyResult> {
    const result: HeadingHierarchyResult = {
      headings: [],
      hasH1: false,
      hasProperHierarchy: true,
      violations: [],
      score: 0
    };

    const headingElements = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    
    for (let i = 0; i < headingElements.length; i++) {
      const heading = headingElements[i];
      const level = parseInt(await heading.evaluate(el => el.tagName.charAt(1)));
      const text = await heading.textContent();
      const isVisible = await heading.isVisible();

      result.headings.push({
        level,
        text: text?.trim() || '',
        isVisible,
        position: i + 1
      });
    }

    // Check for H1
    const h1Count = result.headings.filter(h => h.level === 1).length;
    if (h1Count === 1) {
      result.hasH1 = true;
    } else if (h1Count === 0) {
      result.violations.push('Missing H1 element - every page should have exactly one H1');
    } else {
      result.violations.push(`Multiple H1 elements found (${h1Count}) - should have exactly one`);
    }

    // Validate hierarchy
    let previousLevel = 0;
    for (const heading of result.headings) {
      if (heading.level > previousLevel + 1 && previousLevel > 0) {
        result.violations.push(
          `Heading level ${heading.level} skips from level ${previousLevel}: "${heading.text}"`
        );
        result.hasProperHierarchy = false;
      }
      previousLevel = heading.level;
    }

    // Check for empty headings
    const emptyHeadings = result.headings.filter(h => !h.text.trim());
    if (emptyHeadings.length > 0) {
      result.violations.push(`${emptyHeadings.length} empty heading(s) found`);
    }

    // Calculate score
    let score = 100;
    if (!result.hasH1) score -= 30;
    if (!result.hasProperHierarchy) score -= 40;
    score -= Math.min(30, emptyHeadings.length * 10);

    result.score = Math.max(0, score);

    return result;
  }

  /**
   * Validate landmark usage
   */
  private async validateLandmarks(): Promise<LandmarkUsageResult> {
    const result: LandmarkUsageResult = {
      landmarks: [],
      hasMain: false,
      hasNav: false,
      hasHeader: false,
      hasFooter: false,
      violations: [],
      score: 0
    };

    // Find semantic landmarks
    const landmarkSelectors = [
      { element: 'main', role: 'main' },
      { element: 'nav', role: 'navigation' },
      { element: 'header', role: 'banner' },
      { element: 'footer', role: 'contentinfo' },
      { element: 'aside', role: 'complementary' },
      { element: 'section', role: 'region' },
      { element: '[role="main"]', role: 'main' },
      { element: '[role="navigation"]', role: 'navigation' },
      { element: '[role="banner"]', role: 'banner' },
      { element: '[role="contentinfo"]', role: 'contentinfo' },
      { element: '[role="complementary"]', role: 'complementary' },
      { element: '[role="region"]', role: 'region' },
      { element: '[role="search"]', role: 'search' }
    ];

    for (const landmark of landmarkSelectors) {
      const elements = await this.page.locator(landmark.element).all();
      
      for (const element of elements) {
        const isVisible = await element.isVisible();
        const hasLabel = await element.evaluate(el => 
          !!(el.getAttribute('aria-label') || 
             el.getAttribute('aria-labelledby') ||
             el.querySelector('h1, h2, h3, h4, h5, h6'))
        );

        result.landmarks.push({
          type: landmark.role,
          element: landmark.element,
          isVisible,
          hasAccessibleName: hasLabel
        });

        // Track specific landmarks
        if (landmark.role === 'main') result.hasMain = true;
        if (landmark.role === 'navigation') result.hasNav = true;
        if (landmark.role === 'banner') result.hasHeader = true;
        if (landmark.role === 'contentinfo') result.hasFooter = true;
      }
    }

    // Check for missing essential landmarks
    if (!result.hasMain) {
      result.violations.push('Missing main landmark - every page should have a main content area');
    }

    if (!result.hasNav) {
      result.violations.push('Missing navigation landmark - consider adding nav element for site navigation');
    }

    // Check for unlabeled landmarks when multiple exist
    const landmarksByType = result.landmarks.reduce((acc, landmark) => {
      acc[landmark.type] = (acc[landmark.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(landmarksByType).forEach(([type, count]) => {
      if (count > 1) {
        const unlabeledCount = result.landmarks
          .filter(l => l.type === type && !l.hasAccessibleName)
          .length;
        
        if (unlabeledCount > 0) {
          result.violations.push(
            `Multiple ${type} landmarks found (${count}) but ${unlabeledCount} lack accessible names`
          );
        }
      }
    });

    // Calculate score
    let score = 50; // Base score
    if (result.hasMain) score += 25;
    if (result.hasNav) score += 15;
    if (result.hasHeader) score += 5;
    if (result.hasFooter) score += 5;

    result.score = Math.min(100, score);

    return result;
  }

  /**
   * Validate form structure
   */
  private async validateFormStructure(): Promise<FormStructureResult> {
    const result: FormStructureResult = {
      forms: [],
      totalInputs: 0,
      labeledInputs: 0,
      violations: [],
      score: 0
    };

    const forms = await this.page.locator('form').all();

    for (const form of forms) {
      const formInfo: FormInfo = {
        hasFieldset: false,
        hasLegend: false,
        inputs: [],
        violations: []
      };

      // Check for fieldset and legend
      const fieldsetCount = await form.locator('fieldset').count();
      const legendCount = await form.locator('legend').count();
      
      formInfo.hasFieldset = fieldsetCount > 0;
      formInfo.hasLegend = legendCount > 0;

      if (fieldsetCount > 0 && legendCount === 0) {
        formInfo.violations.push('Fieldset found without legend');
      }

      // Check form inputs
      const inputs = await form.locator('input, textarea, select').all();
      result.totalInputs += inputs.length;

      for (const input of inputs) {
        const inputInfo = await input.evaluate(el => {
          const id = el.getAttribute('id');
          const type = el.getAttribute('type') || 'text';
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = el.getAttribute('aria-label');
          const hasAriaLabelledBy = el.getAttribute('aria-labelledby');
          const hasTitle = el.getAttribute('title');
          const isRequired = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
          
          return {
            type,
            hasId: !!id,
            hasLabel: !!hasLabel,
            hasAriaLabel: !!hasAriaLabel,
            hasAriaLabelledBy: !!hasAriaLabelledBy,
            hasTitle: !!hasTitle,
            isRequired,
            hasAccessibleName: !!(hasLabel || hasAriaLabel || hasAriaLabelledBy || hasTitle)
          };
        });

        formInfo.inputs.push(inputInfo);

        if (inputInfo.hasAccessibleName) {
          result.labeledInputs++;
        } else {
          formInfo.violations.push(`${inputInfo.type} input lacks accessible name`);
        }

        // Check specific input types
        if (inputInfo.type === 'submit' && !inputInfo.hasAccessibleName) {
          formInfo.violations.push('Submit button lacks accessible name');
        }
      }

      result.forms.push(formInfo);
    }

    // Consolidate violations
    result.violations = result.forms.flatMap(form => form.violations);

    // Calculate score
    if (result.totalInputs === 0) {
      result.score = 100; // No forms to validate
    } else {
      const labelingRate = result.labeledInputs / result.totalInputs;
      result.score = Math.round(labelingRate * 100);
    }

    return result;
  }

  /**
   * Validate list structure
   */
  private async validateListStructure(): Promise<ListStructureResult> {
    const result: ListStructureResult = {
      lists: [],
      violations: [],
      score: 0
    };

    const listElements = await this.page.locator('ul, ol, dl').all();

    for (const list of listElements) {
      const listType = await list.evaluate(el => el.tagName.toLowerCase());
      const listInfo: ListInfo = {
        type: listType as 'ul' | 'ol' | 'dl',
        itemCount: 0,
        hasValidStructure: true,
        violations: []
      };

      if (listType === 'ul' || listType === 'ol') {
        const items = await list.locator('> li').all();
        listInfo.itemCount = items.length;

        if (items.length === 0) {
          listInfo.violations.push(`Empty ${listType} list found`);
          listInfo.hasValidStructure = false;
        }

        // Check for direct text content (should be in li elements)
        const hasDirectText = await list.evaluate(el => {
          const childNodes = Array.from(el.childNodes);
          return childNodes.some(node => 
            node.nodeType === Node.TEXT_NODE && 
            node.textContent?.trim()
          );
        });

        if (hasDirectText) {
          listInfo.violations.push(`${listType} contains direct text content outside of li elements`);
          listInfo.hasValidStructure = false;
        }

      } else if (listType === 'dl') {
        const dts = await list.locator('> dt').count();
        const dds = await list.locator('> dd').count();
        listInfo.itemCount = dts + dds;

        if (dts === 0) {
          listInfo.violations.push('Definition list missing dt elements');
          listInfo.hasValidStructure = false;
        }

        if (dds === 0) {
          listInfo.violations.push('Definition list missing dd elements');
          listInfo.hasValidStructure = false;
        }
      }

      result.lists.push(listInfo);
    }

    // Consolidate violations
    result.violations = result.lists.flatMap(list => list.violations);

    // Calculate score
    const totalLists = result.lists.length;
    if (totalLists === 0) {
      result.score = 100;
    } else {
      const validLists = result.lists.filter(list => list.hasValidStructure).length;
      result.score = Math.round((validLists / totalLists) * 100);
    }

    return result;
  }

  /**
   * Validate table structure
   */
  private async validateTableStructure(): Promise<TableStructureResult> {
    const result: TableStructureResult = {
      tables: [],
      violations: [],
      score: 0
    };

    const tables = await this.page.locator('table').all();

    for (const table of tables) {
      const tableInfo: TableInfo = {
        hasCaption: false,
        hasThead: false,
        hasTbody: false,
        hasTfoot: false,
        hasThElements: false,
        hasScope: false,
        violations: []
      };

      // Check table structure elements
      tableInfo.hasCaption = await table.locator('caption').count() > 0;
      tableInfo.hasThead = await table.locator('thead').count() > 0;
      tableInfo.hasTbody = await table.locator('tbody').count() > 0;
      tableInfo.hasTfoot = await table.locator('tfoot').count() > 0;
      tableInfo.hasThElements = await table.locator('th').count() > 0;

      // Check for scope attributes
      const thWithScope = await table.locator('th[scope]').count();
      tableInfo.hasScope = thWithScope > 0;

      // Validate table accessibility
      if (!tableInfo.hasCaption) {
        tableInfo.violations.push('Table missing caption for accessibility');
      }

      if (!tableInfo.hasThElements) {
        tableInfo.violations.push('Table missing th elements for column/row headers');
      }

      if (tableInfo.hasThElements && !tableInfo.hasScope) {
        tableInfo.violations.push('Table headers missing scope attributes');
      }

      // Check for layout tables (discouraged)
      const hasRole = await table.getAttribute('role');
      if (hasRole === 'presentation' || hasRole === 'none') {
        tableInfo.violations.push('Consider using CSS instead of layout tables');
      }

      result.tables.push(tableInfo);
    }

    // Consolidate violations
    result.violations = result.tables.flatMap(table => table.violations);

    // Calculate score
    if (result.tables.length === 0) {
      result.score = 100;
    } else {
      let totalScore = 0;
      result.tables.forEach(table => {
        let tableScore = 100;
        tableScore -= table.violations.length * 20; // Deduct 20 points per violation
        totalScore += Math.max(0, tableScore);
      });
      result.score = Math.round(totalScore / result.tables.length);
    }

    return result;
  }

  /**
   * Validate media elements
   */
  private async validateMediaElements(): Promise<MediaElementsResult> {
    const result: MediaElementsResult = {
      images: { total: 0, withAlt: 0, decorative: 0, violations: [] },
      videos: { total: 0, withCaptions: 0, withTranscripts: 0, violations: [] },
      audio: { total: 0, withTranscripts: 0, violations: [] },
      score: 0
    };

    // Validate images
    const images = await this.page.locator('img').all();
    result.images.total = images.length;

    for (const img of images) {
      const imgInfo = await img.evaluate(el => ({
        alt: el.getAttribute('alt'),
        hasAlt: el.hasAttribute('alt'),
        src: el.getAttribute('src') || '',
        role: el.getAttribute('role')
      }));

      if (imgInfo.hasAlt) {
        if (imgInfo.alt === '') {
          result.images.decorative++;
        } else {
          result.images.withAlt++;
        }
      } else {
        result.images.violations.push(`Image missing alt attribute: ${imgInfo.src.substring(0, 50)}`);
      }

      // Check for role="presentation" as alternative to empty alt
      if (imgInfo.role === 'presentation' || imgInfo.role === 'none') {
        result.images.decorative++;
      }
    }

    // Validate videos
    const videos = await this.page.locator('video').all();
    result.videos.total = videos.length;

    for (const video of videos) {
      const videoInfo = await video.evaluate(el => ({
        hasControls: el.hasAttribute('controls'),
        hasCaptions: !!el.querySelector('track[kind="captions"], track[kind="subtitles"]'),
        hasDescription: !!el.querySelector('track[kind="descriptions"]')
      }));

      if (videoInfo.hasCaptions) result.videos.withCaptions++;
      if (videoInfo.hasDescription) result.videos.withTranscripts++;

      if (!videoInfo.hasControls) {
        result.videos.violations.push('Video missing controls attribute');
      }

      if (!videoInfo.hasCaptions) {
        result.videos.violations.push('Video missing captions/subtitles track');
      }
    }

    // Validate audio
    const audioElements = await this.page.locator('audio').all();
    result.audio.total = audioElements.length;

    for (const audio of audioElements) {
      const audioInfo = await audio.evaluate(el => ({
        hasControls: el.hasAttribute('controls'),
        hasTranscript: !!el.nextElementSibling?.textContent?.toLowerCase().includes('transcript')
      }));

      if (audioInfo.hasTranscript) result.audio.withTranscripts++;

      if (!audioInfo.hasControls) {
        result.audio.violations.push('Audio missing controls attribute');
      }

      if (!audioInfo.hasTranscript) {
        result.audio.violations.push('Audio missing transcript');
      }
    }

    // Calculate score
    const totalMedia = result.images.total + result.videos.total + result.audio.total;
    if (totalMedia === 0) {
      result.score = 100;
    } else {
      const accessibleImages = result.images.withAlt + result.images.decorative;
      const imageScore = result.images.total > 0 ? (accessibleImages / result.images.total) * 100 : 100;
      const videoScore = result.videos.total > 0 ? (result.videos.withCaptions / result.videos.total) * 100 : 100;
      const audioScore = result.audio.total > 0 ? (result.audio.withTranscripts / result.audio.total) * 100 : 100;

      result.score = Math.round((imageScore + videoScore + audioScore) / 3);
    }

    return result;
  }

  /**
   * Validate interactive elements
   */
  private async validateInteractiveElements(): Promise<InteractiveElementsResult> {
    const result: InteractiveElementsResult = {
      buttons: { total: 0, withAccessibleName: 0, violations: [] },
      links: { total: 0, withAccessibleName: 0, withMeaningfulText: 0, violations: [] },
      inputs: { total: 0, withLabels: 0, violations: [] },
      score: 0
    };

    // Validate buttons
    const buttons = await this.page.locator('button, [role="button"]').all();
    result.buttons.total = buttons.length;

    for (const button of buttons) {
      const buttonInfo = await button.evaluate(el => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');
        
        return {
          text,
          hasAccessibleName: !!(text || ariaLabel || ariaLabelledBy || title),
          type: el.getAttribute('type') || 'button'
        };
      });

      if (buttonInfo.hasAccessibleName) {
        result.buttons.withAccessibleName++;
      } else {
        result.buttons.violations.push(`Button missing accessible name (type: ${buttonInfo.type})`);
      }
    }

    // Validate links
    const links = await this.page.locator('a').all();
    result.links.total = links.length;

    for (const link of links) {
      const linkInfo = await link.evaluate(el => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');
        const href = el.getAttribute('href');
        
        const genericTexts = ['click here', 'read more', 'more', 'link', 'here'];
        const isMeaningful = text && !genericTexts.some(generic => 
          text.toLowerCase().includes(generic)
        );
        
        return {
          text,
          href,
          hasAccessibleName: !!(text || ariaLabel || ariaLabelledBy || title),
          isMeaningful: !!isMeaningful
        };
      });

      if (linkInfo.hasAccessibleName) {
        result.links.withAccessibleName++;
        
        if (linkInfo.isMeaningful) {
          result.links.withMeaningfulText++;
        } else {
          result.links.violations.push(
            `Link has generic text: "${linkInfo.text}" (href: ${linkInfo.href})`
          );
        }
      } else {
        result.links.violations.push(`Link missing accessible name (href: ${linkInfo.href})`);
      }
    }

    // Validate inputs (basic check, detailed validation in form structure)
    const inputs = await this.page.locator('input, textarea, select').all();
    result.inputs.total = inputs.length;

    for (const input of inputs) {
      const inputInfo = await input.evaluate(el => {
        const id = el.getAttribute('id');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = el.getAttribute('aria-label');
        
        return {
          type: el.getAttribute('type') || 'text',
          hasLabel: !!(hasLabel || hasAriaLabel)
        };
      });

      if (inputInfo.hasLabel) {
        result.inputs.withLabels++;
      } else {
        result.inputs.violations.push(`Input missing label (type: ${inputInfo.type})`);
      }
    }

    // Calculate score
    const buttonScore = result.buttons.total > 0 ? 
      (result.buttons.withAccessibleName / result.buttons.total) * 100 : 100;
    const linkScore = result.links.total > 0 ? 
      (result.links.withMeaningfulText / result.links.total) * 100 : 100;
    const inputScore = result.inputs.total > 0 ? 
      (result.inputs.withLabels / result.inputs.total) * 100 : 100;

    result.score = Math.round((buttonScore + linkScore + inputScore) / 3);

    return result;
  }

  /**
   * Calculate overall semantic score
   */
  private calculateSemanticScore(result: SemanticValidationResult): number {
    const scores = [
      result.documentStructure.score,
      result.headingHierarchy.score,
      result.landmarksUsage.score,
      result.formStructure.score,
      result.listStructure.score,
      result.tableStructure.score,
      result.mediaElements.score,
      result.interactiveElements.score
    ];

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  /**
   * Generate semantic recommendations
   */
  private generateSemanticRecommendations(result: SemanticValidationResult): string[] {
    const recommendations: string[] = [];

    // Document structure recommendations
    if (result.documentStructure.score < 80) {
      recommendations.push('Improve document structure with proper DOCTYPE, lang attribute, and meta tags');
    }

    // Heading recommendations
    if (!result.headingHierarchy.hasH1) {
      recommendations.push('Add exactly one H1 element to establish page hierarchy');
    }
    
    if (!result.headingHierarchy.hasProperHierarchy) {
      recommendations.push('Fix heading hierarchy - avoid skipping heading levels');
    }

    // Landmarks recommendations
    if (!result.landmarksUsage.hasMain) {
      recommendations.push('Add main landmark to identify primary content area');
    }

    if (result.landmarksUsage.landmarks.length < 2) {
      recommendations.push('Consider adding more semantic landmarks (nav, header, footer, aside)');
    }

    // Form recommendations
    if (result.formStructure.score < 90) {
      recommendations.push('Ensure all form controls have proper labels');
    }

    // Media recommendations
    if (result.mediaElements.images.violations.length > 0) {
      recommendations.push('Add alt attributes to all images');
    }

    if (result.mediaElements.videos.violations.length > 0) {
      recommendations.push('Add captions and controls to video elements');
    }

    // Interactive elements recommendations
    if (result.interactiveElements.buttons.violations.length > 0) {
      recommendations.push('Ensure all buttons have accessible names');
    }

    if (result.interactiveElements.links.violations.length > 0) {
      recommendations.push('Use meaningful link text instead of generic phrases');
    }

    return recommendations;
  }
}

// Type definitions for semantic validation
export interface SemanticValidationResult {
  documentStructure: DocumentStructureResult;
  headingHierarchy: HeadingHierarchyResult;
  landmarksUsage: LandmarkUsageResult;
  formStructure: FormStructureResult;
  listStructure: ListStructureResult;
  tableStructure: TableStructureResult;
  mediaElements: MediaElementsResult;
  interactiveElements: InteractiveElementsResult;
  overallScore: number;
  recommendations: string[];
}

export interface DocumentStructureResult {
  hasValidDoctype: boolean;
  hasHtmlLang: boolean;
  hasTitle: boolean;
  hasMetaViewport: boolean;
  hasMetaDescription: boolean;
  violations: string[];
  score: number;
}

export interface HeadingHierarchyResult {
  headings: { level: number; text: string; isVisible: boolean; position: number }[];
  hasH1: boolean;
  hasProperHierarchy: boolean;
  violations: string[];
  score: number;
}

export interface LandmarkUsageResult {
  landmarks: { type: string; element: string; isVisible: boolean; hasAccessibleName: boolean }[];
  hasMain: boolean;
  hasNav: boolean;
  hasHeader: boolean;
  hasFooter: boolean;
  violations: string[];
  score: number;
}

export interface FormStructureResult {
  forms: FormInfo[];
  totalInputs: number;
  labeledInputs: number;
  violations: string[];
  score: number;
}

export interface FormInfo {
  hasFieldset: boolean;
  hasLegend: boolean;
  inputs: InputInfo[];
  violations: string[];
}

export interface InputInfo {
  type: string;
  hasId: boolean;
  hasLabel: boolean;
  hasAriaLabel: boolean;
  hasAriaLabelledBy: boolean;
  hasTitle: boolean;
  isRequired: boolean;
  hasAccessibleName: boolean;
}

export interface ListStructureResult {
  lists: ListInfo[];
  violations: string[];
  score: number;
}

export interface ListInfo {
  type: 'ul' | 'ol' | 'dl';
  itemCount: number;
  hasValidStructure: boolean;
  violations: string[];
}

export interface TableStructureResult {
  tables: TableInfo[];
  violations: string[];
  score: number;
}

export interface TableInfo {
  hasCaption: boolean;
  hasThead: boolean;
  hasTbody: boolean;
  hasTfoot: boolean;
  hasThElements: boolean;
  hasScope: boolean;
  violations: string[];
}

export interface MediaElementsResult {
  images: {
    total: number;
    withAlt: number;
    decorative: number;
    violations: string[];
  };
  videos: {
    total: number;
    withCaptions: number;
    withTranscripts: number;
    violations: string[];
  };
  audio: {
    total: number;
    withTranscripts: number;
    violations: string[];
  };
  score: number;
}

export interface InteractiveElementsResult {
  buttons: {
    total: number;
    withAccessibleName: number;
    violations: string[];
  };
  links: {
    total: number;
    withAccessibleName: number;
    withMeaningfulText: number;
    violations: string[];
  };
  inputs: {
    total: number;
    withLabels: number;
    violations: string[];
  };
  score: number;
}