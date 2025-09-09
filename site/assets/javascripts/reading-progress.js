/* MediaNest Documentation Reading Progress Indicator - 2025 Enhanced */

(function() {
    'use strict';

    class MediaNestReadingProgress {
        constructor() {
            this.progressBar = null;
            this.isVisible = false;
            this.scrollThreshold = 100; // Show after scrolling 100px
            this.sections = [];
            this.currentSection = null;
            this.readingTime = 0;
            this.startTime = Date.now();
            
            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        }

        setup() {
            this.createProgressBar();
            this.setupScrollListener();
            this.analyzeSections();
            this.calculateReadingTime();
            this.setupVisibilityToggle();
            this.setupKeyboardShortcuts();
        }

        createProgressBar() {
            // Create progress bar container
            const container = document.createElement('div');
            container.className = 'medianest-reading-progress';
            container.innerHTML = `
                <div class="reading-progress-bar"></div>
                <div class="reading-progress-info">
                    <span class="progress-percentage">0%</span>
                    <span class="reading-time-estimate">0 min read</span>
                    <span class="current-section"></span>
                </div>
            `;

            // Style the progress bar
            this.styleProgressBar(container);
            
            // Add to page
            document.body.appendChild(container);
            this.progressBar = container;

            // Initially hidden
            container.style.transform = 'translateY(-100%)';
        }

        styleProgressBar(container) {
            const style = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 4px;
                z-index: 1000;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                transition: transform 0.3s ease, height 0.3s ease;
                border-bottom: 1px solid rgba(103, 58, 183, 0.2);
            `;
            container.style.cssText = style;
        }

        setupScrollListener() {
            let ticking = false;
            
            const updateProgress = () => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = Math.min((scrollTop / documentHeight) * 100, 100);

                this.updateProgressBar(scrollPercent);
                this.updateCurrentSection(scrollTop);
                this.toggleVisibility(scrollTop);
                this.trackReadingTime();

                ticking = false;
            };

            const handleScroll = () => {
                if (!ticking) {
                    requestAnimationFrame(updateProgress);
                    ticking = true;
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            
            // Initial update
            updateProgress();
        }

        analyzeSections() {
            // Find all headings to create section map
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            this.sections = [];

            headings.forEach((heading, index) => {
                const rect = heading.getBoundingClientRect();
                const offsetTop = rect.top + window.pageYOffset;
                
                this.sections.push({
                    id: heading.id || `section-${index}`,
                    title: heading.textContent.trim(),
                    level: parseInt(heading.tagName.charAt(1)),
                    offsetTop: offsetTop,
                    element: heading
                });
            });

            // Sort by position
            this.sections.sort((a, b) => a.offsetTop - b.offsetTop);
        }

        calculateReadingTime() {
            // Calculate estimated reading time
            const content = document.querySelector('.md-content, main, article');
            if (content) {
                const text = content.textContent || content.innerText || '';
                const wordsPerMinute = 200; // Average reading speed
                const words = text.trim().split(/\s+/).length;
                this.readingTime = Math.ceil(words / wordsPerMinute);
                
                // Update reading time display
                const timeDisplay = this.progressBar?.querySelector('.reading-time-estimate');
                if (timeDisplay) {
                    timeDisplay.textContent = `${this.readingTime} min read`;
                }
            }
        }

        updateProgressBar(percentage) {
            if (!this.progressBar) return;

            const bar = this.progressBar.querySelector('.reading-progress-bar');
            const percentageDisplay = this.progressBar.querySelector('.progress-percentage');
            
            if (bar) {
                bar.style.width = `${percentage}%`;
                bar.style.background = `linear-gradient(90deg, 
                    #673ab7 0%, 
                    #9c27b0 50%, 
                    #e1bee7 100%)`;
            }

            if (percentageDisplay) {
                percentageDisplay.textContent = `${Math.round(percentage)}%`;
            }
        }

        updateCurrentSection(scrollTop) {
            if (!this.sections.length) return;

            // Find current section
            let currentSection = this.sections[0];
            
            for (let i = 1; i < this.sections.length; i++) {
                if (scrollTop + 100 >= this.sections[i].offsetTop) {
                    currentSection = this.sections[i];
                } else {
                    break;
                }
            }

            if (currentSection !== this.currentSection) {
                this.currentSection = currentSection;
                this.updateSectionDisplay(currentSection);
                this.announceSection(currentSection);
            }
        }

        updateSectionDisplay(section) {
            const sectionDisplay = this.progressBar?.querySelector('.current-section');
            if (sectionDisplay && section) {
                // Truncate long titles
                let title = section.title;
                if (title.length > 30) {
                    title = title.substring(0, 27) + '...';
                }
                sectionDisplay.textContent = title;
                sectionDisplay.title = section.title; // Full title in tooltip
            }
        }

        toggleVisibility(scrollTop) {
            if (!this.progressBar) return;

            const shouldShow = scrollTop > this.scrollThreshold;
            
            if (shouldShow !== this.isVisible) {
                this.isVisible = shouldShow;
                
                if (shouldShow) {
                    this.progressBar.style.transform = 'translateY(0)';
                    this.progressBar.setAttribute('aria-hidden', 'false');
                } else {
                    this.progressBar.style.transform = 'translateY(-100%)';
                    this.progressBar.setAttribute('aria-hidden', 'true');
                }
            }
        }

        setupVisibilityToggle() {
            // Add toggle button for users who want to hide/show
            const toggleButton = document.createElement('button');
            toggleButton.className = 'reading-progress-toggle';
            toggleButton.innerHTML = '📖';
            toggleButton.setAttribute('aria-label', 'Toggle reading progress');
            toggleButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: var(--md-primary-fg-color);
                color: var(--md-primary-bg-color);
                border: none;
                cursor: pointer;
                font-size: 20px;
                z-index: 1001;
                box-shadow: 0 4px 12px rgba(103, 58, 183, 0.3);
                transition: all 0.3s ease;
                display: none;
            `;

            toggleButton.addEventListener('click', () => {
                this.toggleProgressBar();
            });

            document.body.appendChild(toggleButton);

            // Show toggle button when progress bar is visible
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const isProgressVisible = this.progressBar.style.transform === 'translateY(0px)';
                        toggleButton.style.display = isProgressVisible ? 'block' : 'none';
                    }
                });
            });

            if (this.progressBar) {
                observer.observe(this.progressBar, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        }

        toggleProgressBar() {
            if (!this.progressBar) return;

            const isExpanded = this.progressBar.classList.contains('expanded');
            
            if (isExpanded) {
                this.progressBar.classList.remove('expanded');
                this.progressBar.style.height = '4px';
            } else {
                this.progressBar.classList.add('expanded');
                this.progressBar.style.height = '60px';
            }
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + Shift + P to toggle progress bar
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                    e.preventDefault();
                    this.toggleProgressBar();
                }

                // Ctrl/Cmd + Shift + N/B for next/previous section
                if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                    if (e.key === 'N') {
                        e.preventDefault();
                        this.navigateToSection('next');
                    } else if (e.key === 'B') {
                        e.preventDefault();
                        this.navigateToSection('previous');
                    }
                }
            });
        }

        navigateToSection(direction) {
            if (!this.sections.length || !this.currentSection) return;

            const currentIndex = this.sections.indexOf(this.currentSection);
            let targetIndex;

            if (direction === 'next') {
                targetIndex = Math.min(currentIndex + 1, this.sections.length - 1);
            } else {
                targetIndex = Math.max(currentIndex - 1, 0);
            }

            const targetSection = this.sections[targetIndex];
            if (targetSection && targetSection !== this.currentSection) {
                targetSection.element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                this.announceNavigation(targetSection, direction);
            }
        }

        trackReadingTime() {
            // Track actual time spent reading
            const currentTime = Date.now();
            const sessionTime = (currentTime - this.startTime) / 1000 / 60; // minutes
            
            // Update session storage with reading progress
            try {
                const progress = {
                    url: window.location.pathname,
                    timeSpent: sessionTime,
                    sections: this.sections.length,
                    currentSection: this.currentSection?.title || '',
                    timestamp: currentTime
                };
                
                sessionStorage.setItem('medianest-reading-progress', JSON.stringify(progress));
            } catch (e) {
                // Silently fail if storage not available
            }
        }

        announceSection(section) {
            // Announce section changes to screen readers
            const announcement = document.getElementById('live-region');
            if (announcement && section) {
                announcement.textContent = `Now reading: ${section.title}`;
                setTimeout(() => {
                    announcement.textContent = '';
                }, 2000);
            }
        }

        announceNavigation(section, direction) {
            const announcement = document.getElementById('live-region');
            if (announcement && section) {
                announcement.textContent = `Navigated to ${direction} section: ${section.title}`;
                setTimeout(() => {
                    announcement.textContent = '';
                }, 2000);
            }
        }

        // Public API
        getCurrentSection() {
            return this.currentSection;
        }

        getSections() {
            return [...this.sections];
        }

        getReadingTime() {
            return this.readingTime;
        }

        getProgress() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
            return Math.min((scrollTop / documentHeight) * 100, 100);
        }
    }

    // Add enhanced CSS
    const style = document.createElement('style');
    style.textContent = `
        .medianest-reading-progress {
            font-family: var(--md-text-font-family, 'Roboto', sans-serif);
        }
        
        .reading-progress-bar {
            height: 100%;
            width: 0%;
            transition: width 0.2s ease;
            border-radius: 0 2px 2px 0;
        }
        
        .reading-progress-info {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--md-default-bg-color);
            border: 1px solid var(--md-default-fg-color--lighter);
            border-top: none;
            padding: 8px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: var(--md-default-fg-color--light);
            opacity: 0;
            transform: translateY(-100%);
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .medianest-reading-progress.expanded .reading-progress-info {
            opacity: 1;
            transform: translateY(0);
        }
        
        .progress-percentage {
            font-weight: 600;
            color: var(--md-primary-fg-color);
        }
        
        .current-section {
            font-style: italic;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .reading-progress-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(103, 58, 183, 0.4);
        }
        
        @media (max-width: 768px) {
            .reading-progress-info {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
                padding: 6px 12px;
            }
            
            .current-section {
                max-width: none;
            }
        }
        
        @media (prefers-reduced-motion: reduce) {
            .medianest-reading-progress,
            .reading-progress-bar,
            .reading-progress-info,
            .reading-progress-toggle {
                transition: none !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize reading progress
    let readingProgress;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            readingProgress = new MediaNestReadingProgress();
        });
    } else {
        readingProgress = new MediaNestReadingProgress();
    }

    // Export for external use
    window.MediaNestReadingProgress = {
        getCurrentSection: () => readingProgress?.getCurrentSection(),
        getSections: () => readingProgress?.getSections() || [],
        getReadingTime: () => readingProgress?.getReadingTime() || 0,
        getProgress: () => readingProgress?.getProgress() || 0,
        navigateToSection: (direction) => readingProgress?.navigateToSection(direction)
    };

})();