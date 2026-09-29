import React, { createContext, useContext, useEffect } from 'react';
import { useAccessibility } from './useAccessibility';
import { earconManager } from './audio/EarconManager';
import { dispatchAccessibilityEvent } from './events/AccessibilityEventBus';

interface AccessibilityContextValue extends ReturnType<typeof useAccessibility> {}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const a11y = useAccessibility();

  // Unlock audio context and listen for keyboard-driven focus changes
  useEffect(() => {
    earconManager.unlock();

    let isKeyboardNav = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        isKeyboardNav = true;
      }
    };

    const onMouseDown = () => {
      isKeyboardNav = false;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isKeyboardNav) return;
      const target = e.target as HTMLElement | null;
      if (!target || target === document.body || target === document.documentElement) return;

      const isInteractive =
        ['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
        target.hasAttribute('role') ||
        target.tabIndex >= 0;

      if (isInteractive) {
        dispatchAccessibilityEvent(
          'FOCUS_CHANGED',
          {
            targetElement: target.tagName,
            label: target.getAttribute('aria-label') || target.innerText?.slice(0, 30),
            role: target.getAttribute('role') || undefined,
          },
          'LOW'
        );
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('focusin', onFocusIn, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  return (
    <AccessibilityContext.Provider value={a11y}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export function useAccessibilityContext(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibilityContext must be used within an AccessibilityProvider');
  }
  return ctx;
}
