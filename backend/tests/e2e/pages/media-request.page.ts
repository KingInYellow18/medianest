import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class MediaRequestPage extends BasePage {
  // Selectors
  private readonly selectors = {
    requestForm: '[data-testid="media-request-form"]',
    titleInput: '[data-testid="request-title-input"]',
    descriptionTextarea: '[data-testid="request-description-textarea"]',
    typeSelect: '[data-testid="request-type-select"]',
    prioritySelect: '[data-testid="request-priority-select"]',
    dueDateInput: '[data-testid="request-due-date-input"]',
    tagsInput: '[data-testid="request-tags-input"]',
    attachmentInput: '[data-testid="request-attachment-input"]',
    submitButton: '[data-testid="submit-request-button"]',
    cancelButton: '[data-testid="cancel-request-button"]',
    saveAsDraftButton: '[data-testid="save-as-draft-button"]',
    
    // YouTube specific fields
    youtubeUrlInput: '[data-testid="youtube-url-input"]',
    videoQualitySelect: '[data-testid="video-quality-select"]',
    formatSelect: '[data-testid="format-select"]',
    startTimeInput: '[data-testid="start-time-input"]',
    endTimeInput: '[data-testid="end-time-input"]',
    
    // Form validation
    validationErrors: '[data-testid="validation-error"]',
    fieldError: '[data-testid="field-error"]',
    
    // Success/Error messages
    successMessage: '[data-testid="success-message"]',
    errorMessage: '[data-testid="error-message"]',
    
    // Loading states
    loadingSpinner: '[data-testid="loading-spinner"]',
    previewSection: '[data-testid="preview-section"]',
    
    // Request details (for viewing existing requests)
    requestDetails: '[data-testid="request-details"]',
    requestTitle: '[data-testid="request-title"]',
    requestDescription: '[data-testid="request-description"]',
    requestStatus: '[data-testid="request-status"]',
    requestProgress: '[data-testid="request-progress"]',
    
    // Actions for existing requests
    editButton: '[data-testid="edit-request-button"]',
    deleteButton: '[data-testid="delete-request-button"]',
    downloadButton: '[data-testid="download-button"]',
    
    // Comments section
    commentsSection: '[data-testid="comments-section"]',
    commentInput: '[data-testid="comment-input"]',
    addCommentButton: '[data-testid="add-comment-button"]',
    commentItem: '[data-testid="comment-item"]'
  };
}

// Form data interface
interface MediaRequestData {
    title: string;
    description: string;
    type: 'youtube' | 'audio' | 'video' | 'document';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
    tags?: string[];
    youtubeUrl?: string;
    quality?: string;
    format?: string;
    startTime?: string;
    endTime?: string;
  }

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to new media request page
   */
  async navigate(): Promise<void> {
    await this.goto('/requests/new');
    await this.waitForPageLoad();
    await this.waitForElement(this.selectors.requestForm);
  }

  /**
   * Navigate to view specific request
   */
  async navigateToRequest(requestId: string): Promise<void> {
    await this.goto(`/requests/${requestId}`);
    await this.waitForPageLoad();
    await this.waitForElement(this.selectors.requestDetails);
  }

  /**
   * Fill basic request information
   */
  async fillBasicInfo(title: string, description: string): Promise<void> {
    await this.fillInput(this.selectors.titleInput, title);
    await this.fillInput(this.selectors.descriptionTextarea, description);
  }

  /**
   * Select request type
   */
  async selectRequestType(type: string): Promise<void> {
    await this.selectOption(this.selectors.typeSelect, type);
    
    // Wait for type-specific fields to appear if applicable
    if (type === 'youtube') {
      await this.waitForElement(this.selectors.youtubeUrlInput);
    }
  }

  /**
   * Select priority level
   */
  async selectPriority(priority: string): Promise<void> {
    await this.selectOption(this.selectors.prioritySelect, priority);
  }

  /**
   * Set due date
   */
  async setDueDate(date: string): Promise<void> {
    await this.fillInput(this.selectors.dueDateInput, date);
  }

  /**
   * Add tags
   */
  async addTags(tags: string[]): Promise<void> {
    const tagsString = tags.join(', ');
    await this.fillInput(this.selectors.tagsInput, tagsString);
  }

  /**
   * Fill YouTube specific fields
   */
  async fillYouTubeInfo(url: string, quality = '720p', format = 'mp4'): Promise<void> {
    await this.fillInput(this.selectors.youtubeUrlInput, url);
    await this.selectOption(this.selectors.videoQualitySelect, quality);
    await this.selectOption(this.selectors.formatSelect, format);
  }

  /**
   * Set time range for YouTube video
   */
  async setTimeRange(startTime?: string, endTime?: string): Promise<void> {
    if (startTime) {
      await this.fillInput(this.selectors.startTimeInput, startTime);
    }
    if (endTime) {
      await this.fillInput(this.selectors.endTimeInput, endTime);
    }
  }

  /**
   * Upload attachment
   */
  async uploadAttachment(filePath: string): Promise<void> {
    await this.uploadFile(this.selectors.attachmentInput, filePath);
  }

  /**
   * Submit the request
   */
  async submitRequest(): Promise<void> {
    await this.clickElement(this.selectors.submitButton);
    
    // Wait for either success or error message
    await Promise.race([
      this.waitForElement(this.selectors.successMessage),
      this.waitForElement(this.selectors.errorMessage)
    ]);
  }

  /**
   * Save as draft
   */
  async saveAsDraft(): Promise<void> {
    await this.clickElement(this.selectors.saveAsDraftButton);
    await this.waitForElement(this.selectors.successMessage);
  }

  /**
   * Cancel request creation
   */
  async cancelRequest(): Promise<void> {
    await this.clickElement(this.selectors.cancelButton);
  }

  /**
   * Create complete media request
   */
  async createMediaRequest(data: MediaRequestData): Promise<void> {
    await this.fillBasicInfo(data.title, data.description);
    await this.selectRequestType(data.type);
    await this.selectPriority(data.priority);
    
    if (data.dueDate) {
      await this.setDueDate(data.dueDate);
    }
    
    if (data.tags && data.tags.length > 0) {
      await this.addTags(data.tags);
    }
    
    // Handle type-specific fields
    if (data.type === 'youtube' && data.youtubeUrl) {
      await this.fillYouTubeInfo(
        data.youtubeUrl,
        data.quality || '720p',
        data.format || 'mp4'
      );
      
      if (data.startTime || data.endTime) {
        await this.setTimeRange(data.startTime, data.endTime);
      }
    }
    
    await this.submitRequest();
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errors = await this.page.locator(this.selectors.validationErrors).all();
    const errorMessages = [];
    
    for (const error of errors) {
      const message = await error.textContent();
      if (message) {
        errorMessages.push(message.trim());
      }
    }
    
    return errorMessages;
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.successMessage)) {
      return await this.getTextContent(this.selectors.successMessage);
    }
    return '';
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.errorMessage)) {
      return await this.getTextContent(this.selectors.errorMessage);
    }
    return '';
  }

  /**
   * Check if form is valid
   */
  async isFormValid(): Promise<boolean> {
    const errors = await this.getValidationErrors();
    return errors.length === 0;
  }

  /**
   * Get request details (for viewing existing requests)
   */
  async getRequestDetails(): Promise<any> {
    await this.waitForElement(this.selectors.requestDetails);
    
    return {
      title: await this.getTextContent(this.selectors.requestTitle),
      description: await this.getTextContent(this.selectors.requestDescription),
      status: await this.getTextContent(this.selectors.requestStatus)
    };
  }

  /**
   * Edit existing request
   */
  async editRequest(): Promise<void> {
    await this.clickElement(this.selectors.editButton);
    await this.waitForElement(this.selectors.requestForm);
  }

  /**
   * Delete request
   */
  async deleteRequest(): Promise<void> {
    await this.clickElement(this.selectors.deleteButton);
    
    // Handle confirmation dialog
    await this.acceptDialog();
    
    // Wait for redirect or success message
    await this.waitForNetworkIdle();
  }

  /**
   * Download processed media
   */
  async downloadMedia(): Promise<void> {
    await this.clickElement(this.selectors.downloadButton);
  }

  /**
   * Add comment to request
   */
  async addComment(comment: string): Promise<void> {
    await this.fillInput(this.selectors.commentInput, comment);
    await this.clickElement(this.selectors.addCommentButton);
    await this.waitForNetworkIdle();
  }

  /**
   * Get all comments
   */
  async getComments(): Promise<string[]> {
    const comments = await this.page.locator(this.selectors.commentItem).all();
    const commentTexts = [];
    
    for (const comment of comments) {
      const text = await comment.textContent();
      if (text) {
        commentTexts.push(text.trim());
      }
    }
    
    return commentTexts;
  }

  /**
   * Check request progress
   */
  async getRequestProgress(): Promise<number> {
    if (await this.isElementVisible(this.selectors.requestProgress)) {
      const progressText = await this.getTextContent(this.selectors.requestProgress);
      const match = progressText.match(/(\d+)%/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * Wait for request processing to complete
   */
  async waitForProcessingComplete(timeout = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const progress = await this.getRequestProgress();
      const status = await this.getTextContent(this.selectors.requestStatus);
      
      if (progress === 100 || status.toLowerCase().includes('completed')) {
        return;
      }
      
      await this.page.waitForTimeout(2000); // Wait 2 seconds before checking again
    }
    
    throw new Error(`Request processing did not complete within ${timeout}ms`);
  }

  /**
   * Verify form elements are present
   */
  async verifyFormElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.titleInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.descriptionTextarea)).toBeVisible();
    await expect(this.page.locator(this.selectors.typeSelect)).toBeVisible();
    await expect(this.page.locator(this.selectors.prioritySelect)).toBeVisible();
    await expect(this.page.locator(this.selectors.submitButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.cancelButton)).toBeVisible();
  }
}