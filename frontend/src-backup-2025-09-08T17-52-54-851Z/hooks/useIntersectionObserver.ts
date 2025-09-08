'use client';

import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

interface UseIntersectionObserverCallback {
  onIntersect?: () => void;
  onLeave?: () => void;
}

export function useIntersectionObserver(
  elementRef: React.RefObject<Element | null>,
  {
    threshold = 0,
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = false,
    onIntersect,
    onLeave,
  }: UseIntersectionObserverOptions & UseIntersectionObserverCallback = {}
): IntersectionObserverEntry | undefined {
  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  const frozen = useRef(false);

  const updateEntry = ([entry]: IntersectionObserverEntry[]): void => {
    setEntry(entry);

    if (entry.isIntersecting) {
      onIntersect?.();
    } else {
      onLeave?.();
    }
  };

  useEffect(() => {
    const node = elementRef?.current;
    const hasIOSupport = !!window.IntersectionObserver;

    if (!hasIOSupport || frozen.current || !node) return;

    const observerParams = { threshold, root, rootMargin };
    const observer = new IntersectionObserver(updateEntry, observerParams);

    observer.observe(node);

    return () => observer.disconnect();
  }, [elementRef, threshold, root, rootMargin, onIntersect, onLeave]);

  useEffect(() => {
    if (entry?.isIntersecting && freezeOnceVisible) {
      frozen.current = true;
    }
  }, [entry, freezeOnceVisible]);

  return entry;
}

// Simplified hook for common use case
export function useIsIntersecting(
  elementRef: React.RefObject<Element | null>,
  options?: UseIntersectionObserverOptions
): boolean {
  const entry = useIntersectionObserver(elementRef, options);
  return !!entry?.isIntersecting;
}
