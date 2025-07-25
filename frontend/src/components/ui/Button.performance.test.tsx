import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button } from './Button';
import { PerformanceTester, perfUtils } from '@/lib/test-utils/performance';

// Extend expect with performance matchers
expect.extend(perfUtils.matchers);

describe('Button Performance Tests', () => {
  beforeEach(() => {
    // Reset performance metrics before each test
    global.performanceMetrics.reset();
  });

  describe('Render Performance', () => {
    test('should render within acceptable time threshold', async () => {
      const metrics = await perfUtils.measure(
        Button,
        { children: 'Performance Test Button' },
        10 // 10 iterations
      );
      
      expect(metrics.renderTime).toBeLessThan(perfUtils.benchmarks.RENDER_TIME_THRESHOLD);
      expect(metrics.renderTime).toRenderWithin(16); // 60fps target
    });

    test('should handle all variants with consistent performance', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
      const results: Array<{ variant: string; renderTime: number }> = [];
      
      for (const variant of variants) {
        const metrics = await perfUtils.measure(
          Button,
          { variant, children: `${variant} button` },
          5
        );
        
        results.push({ variant, renderTime: metrics.renderTime });
        expect(metrics.renderTime).toBeLessThan(20); // Slightly higher threshold for variants
      }
      
      // Ensure consistent performance across variants (no variant should be 2x slower)
      const maxTime = Math.max(...results.map(r => r.renderTime));
      const minTime = Math.min(...results.map(r => r.renderTime));
      
      expect(maxTime / minTime).toBeLessThan(2);
    });

    test('should maintain performance with complex content', async () => {
      const ComplexButton = (props: any) => (
        <Button {...props}>
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Complex Button Content
            <span className="ml-2 px-2 py-1 bg-blue-100 text-xs rounded">Badge</span>
          </span>
        </Button>
      );
      
      const metrics = await perfUtils.measure(ComplexButton, {}, 5);
      
      expect(metrics.renderTime).toBeLessThan(25); // Slightly higher threshold for complex content
    });

    test('should handle loading state efficiently', async () => {
      const loadingMetrics = await perfUtils.measure(
        Button,
        { loading: true, children: 'Loading Button' },
        5
      );
      
      const normalMetrics = await perfUtils.measure(
        Button,
        { children: 'Normal Button' },
        5
      );
      
      // Loading state should not be significantly slower
      expect(loadingMetrics.renderTime).toBeLessThan(normalMetrics.renderTime * 1.5);
    });
  });

  describe('Memory Performance', () => {
    test('should not leak memory during mount/unmount cycles', async () => {
      const memoryTest = await perfUtils.testMemoryLeaks(
        Button,
        { children: 'Memory Test Button' },
        25 // 25 mount/unmount cycles
      );
      
      expect(memoryTest).toNotLeakMemory();
      expect(memoryTest.growthBytes).toBeLessThan(perfUtils.benchmarks.MEMORY_LEAK_THRESHOLD);
    });

    test('should handle memory efficiently with different states', async () => {
      const states = [
        { disabled: true },
        { loading: true },
        { variant: 'destructive' as const },
        { size: 'lg' as const }
      ];
      
      for (const state of states) {
        const memoryTest = await perfUtils.testMemoryLeaks(
          Button,
          { ...state, children: 'State Test Button' },
          15
        );
        
        expect(memoryTest.leaked).toBe(false);
      }
    });

    test('should manage memory properly with rapid state changes', async () => {
      let renderCount = 0;
      
      const StatefulButton = (props: any) => {
        renderCount++;
        return <Button {...props} />;
      };
      
      const { rerender, unmount } = render(
        <StatefulButton>Initial State</StatefulButton>
      );
      
      const startMemory = perfUtils.getMemoryUsage();
      
      // Rapid state changes
      for (let i = 0; i < 20; i++) {
        rerender(<StatefulButton loading={i % 2 === 0}>State {i}</StatefulButton>);
      }
      
      const endMemory = perfUtils.getMemoryUsage();
      const memoryGrowth = endMemory ? endMemory.used - (startMemory?.used || 0) : 0;
      
      expect(memoryGrowth).toBeLessThan(500 * 1024); // Less than 500KB growth
      expect(renderCount).toBeLessThan(25); // Reasonable render count
      
      unmount();
    });
  });

  describe('Interaction Performance', () => {
    test('should handle click interactions efficiently', async () => {
      const handleClick = vi.fn();
      const component = render(
        <Button onClick={handleClick}>Click Performance Test</Button>
      );
      
      const user = userEvent.setup();
      const button = component.getByRole('button');
      
      const interactions = [
        async () => await user.click(button),
        async () => await user.click(button),
        async () => await user.click(button)
      ];
      
      const results = await perfUtils.testInteractions(component, interactions);
      
      results.interactions.forEach(({ duration, renders }) => {
        expect(duration).toBeLessThan(50); // 50ms for click response
        expect(renders).toBeLessThan(perfUtils.benchmarks.MAX_RENDERS_PER_INTERACTION);
      });
      
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    test('should handle keyboard interactions efficiently', async () => {
      const handleClick = vi.fn();
      const component = render(
        <Button onClick={handleClick}>Keyboard Test</Button>
      );
      
      const user = userEvent.setup();
      const button = component.getByRole('button');
      
      button.focus();
      
      const interactions = [
        async () => await user.keyboard('{Enter}'),
        async () => await user.keyboard(' '),
        async () => await user.keyboard('{Enter}')
      ];
      
      const results = await perfUtils.testInteractions(component, interactions);
      
      results.interactions.forEach(({ duration }) => {
        expect(duration).toBeLessThan(30); // Keyboard should be faster than clicks
      });
      
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    test('should handle rapid successive interactions', async () => {
      const handleClick = vi.fn();
      const component = render(
        <Button onClick={handleClick}>Rapid Click Test</Button>
      );
      
      const user = userEvent.setup();
      const button = component.getByRole('button');
      
      const startTime = performance.now();
      
      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(button);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(500); // All clicks should complete in 500ms
      expect(handleClick).toHaveBeenCalledTimes(10);
    });

    test('should handle hover interactions without performance degradation', async () => {
      const component = render(<Button>Hover Performance Test</Button>);
      const user = userEvent.setup();
      const button = component.getByRole('button');
      
      const startMemory = perfUtils.getMemoryUsage();
      
      // Multiple hover events
      for (let i = 0; i < 20; i++) {
        await user.hover(button);
        await user.unhover(button);
      }
      
      const endMemory = perfUtils.getMemoryUsage();
      const memoryGrowth = endMemory ? endMemory.used - (startMemory?.used || 0) : 0;
      
      expect(memoryGrowth).toBeLessThan(100 * 1024); // Less than 100KB growth
    });
  });

  describe('Load Performance', () => {
    test('should handle multiple concurrent instances', async () => {
      const loadResults = await perfUtils.loadTest(
        Button,
        { children: 'Load Test Button' },
        10 // 10 concurrent instances
      );
      
      expect(loadResults).toHandleLoad();
      expect(loadResults.crashed).toBe(false);
      expect(loadResults.avgRenderTime).toBeLessThan(50); // Should scale reasonably
    });

    test('should maintain performance with many buttons', async () => {
      const ManyButtons = () => (
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <Button key={i} variant={i % 2 === 0 ? 'default' : 'outline'}>
              Button {i}
            </Button>
          ))}
        </div>
      );
      
      const startTime = performance.now();
      const { unmount } = render(<ManyButtons />);
      const renderTime = performance.now() - startTime;
      
      expect(renderTime).toBeLessThan(100); // 50 buttons should render in under 100ms
      
      unmount();
    });

    test('should handle stress test scenarios', async () => {
      const StressButton = ({ iteration }: { iteration: number }) => (
        <Button
          variant={iteration % 2 === 0 ? 'default' : 'destructive'}
          size={iteration % 3 === 0 ? 'sm' : 'default'}
          loading={iteration % 5 === 0}
          disabled={iteration % 7 === 0}
        >
          Stress Button {iteration}
        </Button>
      );
      
      const loadResults = await perfUtils.loadTest(
        StressButton,
        { iteration: 1 },
        20
      );
      
      expect(loadResults.crashed).toBe(false);
      expect(loadResults.memoryPeak).toBeLessThan(2 * 1024 * 1024); // Less than 2MB peak
    });
  });

  describe('Bundle Size and Resource Performance', () => {
    test('should have acceptable bundle size impact', async () => {
      const bundleSize = perfUtils.estimateBundleSize(Button);
      
      expect(bundleSize).toHaveAcceptableBundleSize();
      expect(bundleSize).toBeLessThan(10 * 1024); // Less than 10KB for component
    });

    test('should load efficiently with lazy loading', async () => {
      const LazyButton = React.lazy(() => 
        Promise.resolve({ default: Button })
      );
      
      const startTime = performance.now();
      
      const { unmount } = render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyButton>Lazy Button</LazyButton>
        </React.Suspense>
      );
      
      const loadTime = performance.now() - startTime;
      
      expect(loadTime).toBeLessThan(50); // Should load quickly
      
      unmount();
    });
  });

  describe('First Contentful Paint Performance', () => {
    test('should achieve good FCP metrics', async () => {
      const fcpResults = await perfUtils.measureFCP(() => 
        render(<Button>FCP Test Button</Button>)
      );
      
      expect(fcpResults.fcp).toBeLessThan(100); // FCP under 100ms
      expect(fcpResults.lcp).toBeLessThan(200); // LCP under 200ms
      expect(fcpResults.elements).toBeGreaterThan(0);
    });

    test('should maintain FCP performance with complex content', async () => {
      const ComplexButton = () => (
        <Button variant="outline" size="lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Complex Content</span>
            <div className="flex space-x-1">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            </div>
          </div>
        </Button>
      );
      
      const fcpResults = await perfUtils.measureFCP(() => 
        render(<ComplexButton />)
      );
      
      expect(fcpResults.fcp).toBeLessThan(150); // Slightly higher threshold for complex content
    });
  });

  describe('Comprehensive Performance Test Suite', () => {
    test('should pass all performance benchmarks', async () => {
      const results = await perfUtils.runComprehensive(
        Button,
        { children: 'Comprehensive Test Button' },
        {
          renderIterations: 10,
          memoryLeakCycles: 20,
          loadTestInstances: 8,
          testMemoryLeaks: true,
          testLoadPerformance: true,
          testBundleSize: true
        }
      );
      
      // Verify all performance assertions pass
      expect(results.assertions.renderTimeAcceptable).toBe(true);
      expect(results.assertions.memoryLeakAcceptable).toBe(true);
      expect(results.assertions.loadTestPassed).toBe(true);
      expect(results.assertions.bundleSizeAcceptable).toBe(true);
      expect(results.assertions.fcpAcceptable).toBe(true);
      
      // Log performance stats for debugging
      console.log('Performance Test Results:', {
        avgRenderTime: results.renderPerformance.renderTime,
        memoryGrowth: results.memoryLeaks?.growthBytes,
        bundleSize: results.bundleSize,
        fcp: results.contentfulPaint.fcp
      });
    });

    test('should maintain performance standards across different configurations', async () => {
      const configurations = [
        { variant: 'default' as const, size: 'default' as const },
        { variant: 'destructive' as const, size: 'sm' as const },
        { variant: 'outline' as const, size: 'lg' as const },
        { loading: true, variant: 'secondary' as const },
        { disabled: true, variant: 'ghost' as const }
      ];
      
      const results = [];
      
      for (const config of configurations) {
        const result = await perfUtils.runComprehensive(
          Button,
          { ...config, children: 'Config Test' },
          { renderIterations: 5, memoryLeakCycles: 10, loadTestInstances: 5 }
        );
        
        results.push({
          config,
          renderTime: result.renderPerformance.renderTime,
          memoryLeak: result.memoryLeaks?.leaked,
          bundleSize: result.bundleSize
        });
      }
      
      // Ensure all configurations meet performance standards
      results.forEach(({ config, renderTime, memoryLeak, bundleSize }) => {
        expect(renderTime).toBeLessThan(30);
        expect(memoryLeak).toBe(false);
        expect(bundleSize).toBeLessThan(15 * 1024); // Generous limit for different configs
      });
    });
  });
});