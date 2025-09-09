/* MediaNest Documentation Enhanced Code Copy - 2025 Enhanced */

(function() {
    'use strict';

    class MediaNestCodeCopyEnhancer {
        constructor() {
            this.copyButtons = new Map();
            this.copiedRecently = new Set();
            this.analytics = window.gtag || null;
            
            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }

            // Re-enhance when new content is loaded
            this.observeContentChanges();
        }

        setup() {
            this.enhanceExistingButtons();
            this.addCustomButtons();
            this.setupKeyboardShortcuts();
            this.addBulkCopyFeature();
        }

        enhanceExistingButtons() {
            // Enhance Material theme's built-in copy buttons
            const existingButtons = document.querySelectorAll('.md-clipboard');
            
            existingButtons.forEach(button => {
                this.enhanceButton(button);
            });
        }

        enhanceButton(button) {
            if (this.copyButtons.has(button)) return;

            // Store original functionality
            const originalClick = button.onclick;
            const codeBlock = button.closest('pre') || button.parentElement.querySelector('pre code')?.parentElement;
            
            if (!codeBlock) return;

            // Enhanced click handler
            button.onclick = async (e) => {
                e.preventDefault();
                await this.handleCopy(button, codeBlock);
                
                // Call original if exists
                if (originalClick) {
                    originalClick.call(button, e);
                }
            };

            // Enhanced accessibility
            button.setAttribute('aria-label', 'Copy code to clipboard');
            button.setAttribute('title', 'Copy code to clipboard (Ctrl+Shift+C)');

            // Add keyboard support
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                }
            });

            this.copyButtons.set(button, { codeBlock, enhanced: true });
        }

        addCustomButtons() {
            // Add copy buttons to code blocks that don't have them
            const codeBlocks = document.querySelectorAll('pre:not(.md-clipboard) code');
            
            codeBlocks.forEach(code => {
                const pre = code.parentElement;
                if (!pre.querySelector('.md-clipboard') && !pre.querySelector('.medianest-copy-btn')) {
                    this.createCopyButton(pre);
                }
            });
        }

        createCopyButton(codeBlock) {
            const button = document.createElement('button');
            button.className = 'medianest-copy-btn';
            button.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
            `;
            
            button.setAttribute('aria-label', 'Copy code to clipboard');
            button.setAttribute('title', 'Copy code to clipboard');
            
            // Style the button
            this.styleCustomButton(button);
            
            // Position button
            codeBlock.style.position = 'relative';
            codeBlock.appendChild(button);
            
            // Add click handler
            button.addEventListener('click', async () => {
                await this.handleCopy(button, codeBlock);
            });

            this.copyButtons.set(button, { codeBlock, custom: true });
        }

        styleCustomButton(button) {
            button.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: var(--md-default-fg-color--lighter);
                color: var(--md-default-bg-color);
                border: none;
                border-radius: 4px;
                padding: 6px;
                cursor: pointer;
                opacity: 0.7;
                transition: all 0.2s ease;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            button.addEventListener('mouseenter', () => {
                button.style.opacity = '1';
                button.style.background = 'var(--md-primary-fg-color)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.opacity = '0.7';
                button.style.background = 'var(--md-default-fg-color--lighter)';
            });
        }

        async handleCopy(button, codeBlock) {
            const code = codeBlock.querySelector('code') || codeBlock;
            let textToCopy = this.extractCodeText(code);
            
            // Enhanced processing
            textToCopy = this.preprocessCode(textToCopy, codeBlock);
            
            try {
                await this.copyToClipboard(textToCopy);
                this.showCopyFeedback(button, 'success');
                this.trackCopyEvent(codeBlock, textToCopy.length);
            } catch (error) {
                console.warn('Copy failed:', error);
                this.showCopyFeedback(button, 'error');
                this.fallbackCopy(textToCopy);
            }
        }

        extractCodeText(codeElement) {
            // Handle different code block structures
            let text = '';
            
            if (codeElement.querySelector('.highlight')) {
                // Handle highlighted code
                text = codeElement.querySelector('.highlight').textContent;
            } else {
                text = codeElement.textContent;
            }
            
            // Clean up text
            return text
                .replace(/^\s*\n/, '') // Remove leading newline
                .replace(/\n\s*$/, '') // Remove trailing newline and spaces
                .replace(/\n\s*\d+\s*/g, '\n') // Remove line numbers
                .trim();
        }

        preprocessCode(text, codeBlock) {
            // Get language from class
            const language = this.getCodeLanguage(codeBlock);
            
            // Language-specific preprocessing
            switch (language) {
                case 'bash':
                case 'shell':
                    // Remove $ prompts for shell commands
                    return text.replace(/^\$\s*/gm, '');
                
                case 'diff':
                    // Keep diff markers
                    return text;
                    
                case 'yaml':
                case 'yml':
                    // Ensure proper indentation
                    return text.replace(/\t/g, '  ');
                    
                default:
                    return text;
            }
        }

        getCodeLanguage(codeBlock) {
            const code = codeBlock.querySelector('code');
            if (!code) return null;
            
            const classMatch = code.className.match(/language-(\w+)/);
            return classMatch ? classMatch[1] : null;
        }

        async copyToClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                throw new Error('Clipboard API not available');
            }
        }

        fallbackCopy(text) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.cssText = `
                position: fixed;
                top: -1000px;
                left: -1000px;
                opacity: 0;
                pointer-events: none;
            `;
            
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                const success = document.execCommand('copy');
                if (success) {
                    this.announceToScreenReader('Code copied to clipboard');
                } else {
                    this.showManualCopyDialog(text);
                }
            } catch (error) {
                this.showManualCopyDialog(text);
            } finally {
                document.body.removeChild(textArea);
            }
        }

        showCopyFeedback(button, type) {
            const originalContent = button.innerHTML;
            const originalTitle = button.title;
            
            // Update button appearance
            if (type === 'success') {
                button.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                `;
                button.style.background = '#4caf50';
                button.title = 'Copied!';
                button.setAttribute('aria-label', 'Code copied to clipboard');
                
                this.announceToScreenReader('Code copied to clipboard');
                
            } else {
                button.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                `;
                button.style.background = '#f44336';
                button.title = 'Copy failed';
                
                this.announceToScreenReader('Copy failed, try manual selection');
            }
            
            // Reset after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.title = originalTitle;
                button.style.background = '';
            }, 2000);
            
            // Prevent multiple rapid copies
            const blockId = this.getBlockId(button);
            this.copiedRecently.add(blockId);
            setTimeout(() => {
                this.copiedRecently.delete(blockId);
            }, 1000);
        }

        getBlockId(button) {
            const codeBlock = this.copyButtons.get(button)?.codeBlock;
            return codeBlock ? codeBlock.textContent.substring(0, 50) : Math.random().toString();
        }

        showManualCopyDialog(text) {
            // Create modal for manual copy
            const modal = document.createElement('div');
            modal.className = 'medianest-copy-modal';
            modal.innerHTML = `
                <div class="copy-modal-content">
                    <div class="copy-modal-header">
                        <h3>Manual Copy Required</h3>
                        <button class="copy-modal-close" aria-label="Close">×</button>
                    </div>
                    <div class="copy-modal-body">
                        <p>Please select and copy the code manually:</p>
                        <textarea readonly class="copy-modal-textarea">${text}</textarea>
                        <div class="copy-modal-actions">
                            <button class="copy-modal-select">Select All</button>
                            <button class="copy-modal-close-btn">Close</button>
                        </div>
                    </div>
                </div>
            `;
            
            this.styleModal(modal);
            document.body.appendChild(modal);
            
            // Event handlers
            const closeButtons = modal.querySelectorAll('.copy-modal-close, .copy-modal-close-btn');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => modal.remove());
            });
            
            const selectButton = modal.querySelector('.copy-modal-select');
            const textarea = modal.querySelector('.copy-modal-textarea');
            
            selectButton.addEventListener('click', () => {
                textarea.select();
            });
            
            // Auto-focus textarea
            setTimeout(() => textarea.focus(), 100);
        }

        styleModal(modal) {
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: var(--md-text-font-family);
            `;
            
            const style = document.createElement('style');
            style.textContent = `
                .copy-modal-content {
                    background: var(--md-default-bg-color);
                    border-radius: 8px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80%;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                
                .copy-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--md-default-fg-color--lighter);
                }
                
                .copy-modal-header h3 {
                    margin: 0;
                    color: var(--md-primary-fg-color);
                }
                
                .copy-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--md-default-fg-color--light);
                }
                
                .copy-modal-body {
                    padding: 20px;
                }
                
                .copy-modal-textarea {
                    width: 100%;
                    height: 200px;
                    padding: 12px;
                    border: 1px solid var(--md-default-fg-color--lighter);
                    border-radius: 4px;
                    font-family: var(--md-code-font-family);
                    font-size: 14px;
                    resize: vertical;
                    background: var(--md-code-bg-color);
                }
                
                .copy-modal-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 16px;
                    justify-content: flex-end;
                }
                
                .copy-modal-actions button {
                    padding: 8px 16px;
                    border: 1px solid var(--md-primary-fg-color);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .copy-modal-select {
                    background: var(--md-primary-fg-color);
                    color: var(--md-primary-bg-color);
                }
                
                .copy-modal-close-btn {
                    background: transparent;
                    color: var(--md-primary-fg-color);
                }
            `;
            document.head.appendChild(style);
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + Shift + C to copy focused code block
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                    const focusedCode = document.activeElement.closest('pre');
                    if (focusedCode) {
                        e.preventDefault();
                        const button = focusedCode.querySelector('.md-clipboard, .medianest-copy-btn');
                        if (button) {
                            button.click();
                        }
                    }
                }
            });
        }

        addBulkCopyFeature() {
            // Add bulk copy feature for pages with multiple code blocks
            const codeBlocks = document.querySelectorAll('pre code');
            if (codeBlocks.length > 3) {
                this.createBulkCopyButton();
            }
        }

        createBulkCopyButton() {
            const button = document.createElement('button');
            button.className = 'medianest-bulk-copy';
            button.innerHTML = '📋 Copy All Code';
            button.title = 'Copy all code blocks from this page';
            
            button.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: var(--md-primary-fg-color);
                color: var(--md-primary-bg-color);
                border: none;
                border-radius: 25px;
                padding: 12px 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(103, 58, 183, 0.3);
                transition: all 0.3s ease;
                z-index: 1000;
                opacity: 0.9;
            `;
            
            button.addEventListener('click', () => {
                this.handleBulkCopy();
            });
            
            document.body.appendChild(button);
        }

        async handleBulkCopy() {
            const codeBlocks = document.querySelectorAll('pre code');
            let allCode = '';
            
            codeBlocks.forEach((code, index) => {
                const language = this.getCodeLanguage(code.parentElement);
                const text = this.extractCodeText(code);
                const processedText = this.preprocessCode(text, code.parentElement);
                
                allCode += `// Code Block ${index + 1}${language ? ` (${language})` : ''}\n`;
                allCode += processedText + '\n\n';
            });
            
            try {
                await this.copyToClipboard(allCode.trim());
                this.announceToScreenReader(`Copied ${codeBlocks.length} code blocks to clipboard`);
                this.showBulkCopyFeedback();
            } catch (error) {
                this.showManualCopyDialog(allCode.trim());
            }
        }

        showBulkCopyFeedback() {
            const button = document.querySelector('.medianest-bulk-copy');
            if (!button) return;
            
            const originalText = button.textContent;
            button.textContent = '✅ Copied All!';
            button.style.background = '#4caf50';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = 'var(--md-primary-fg-color)';
            }, 2000);
        }

        observeContentChanges() {
            // Re-enhance when content changes (e.g., SPA navigation)
            const observer = new MutationObserver((mutations) => {
                let shouldReenhance = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.querySelector('pre code') || node.matches('pre')) {
                                    shouldReenhance = true;
                                }
                            }
                        });
                    }
                });
                
                if (shouldReenhance) {
                    setTimeout(() => this.setup(), 100);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        trackCopyEvent(codeBlock, textLength) {
            if (this.analytics) {
                const language = this.getCodeLanguage(codeBlock);
                
                this.analytics('event', 'code_copy', {
                    event_category: 'engagement',
                    event_label: language || 'unknown',
                    value: textLength,
                    custom_parameter_1: window.location.pathname
                });
            }
        }

        announceToScreenReader(message) {
            const announcement = document.getElementById('live-region') || document.createElement('div');
            if (!announcement.id) {
                announcement.id = 'live-region';
                announcement.setAttribute('aria-live', 'polite');
                announcement.className = 'sr-only';
                document.body.appendChild(announcement);
            }
            
            announcement.textContent = message;
            setTimeout(() => {
                announcement.textContent = '';
            }, 1000);
        }
    }

    // Initialize enhanced code copy
    new MediaNestCodeCopyEnhancer();

})();