'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface OnboardingState {
  completed: boolean;
  skipped: boolean;
  currentStep: string;
  completedSteps: string[];
  progress: Record<string, any>;
}

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  skipped: false,
  currentStep: 'welcome',
  completedSteps: [],
  progress: {},
};

const ONBOARDING_STEPS = ['welcome', 'plex-setup', 'services', 'features'];

export function useOnboarding() {
  const { data: session, update: updateSession } = useSession();
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  // Load onboarding state from session/localStorage
  useEffect(() => {
    const loadState = async () => {
      try {
        // Check session for onboarding status
        if (session?.user?.onboardingCompleted) {
          setState(prev => ({ ...prev, completed: true }));
          setIsLoading(false);
          return;
        }

        // Check localStorage for in-progress state
        const savedState = localStorage.getItem('medianest_onboarding');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          setState(parsed);
        }
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [session]);

  // Save state to localStorage
  const saveState = useCallback((newState: OnboardingState) => {
    try {
      localStorage.setItem('medianest_onboarding', JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, []);

  // Update state and save
  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      saveState(newState);
      return newState;
    });
  }, [saveState]);

  // Mark step as complete
  const markStepComplete = useCallback(async (stepId: string) => {
    const completedSteps = [...state.completedSteps];
    if (!completedSteps.includes(stepId)) {
      completedSteps.push(stepId);
    }

    updateState({ completedSteps });

    // If all steps completed, mark onboarding as complete
    if (completedSteps.length === ONBOARDING_STEPS.length) {
      await completeOnboarding();
    }
  }, [state.completedSteps, updateState]);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    try {
      // Update user profile to mark onboarding as complete
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });

      if (response.ok) {
        updateState({ completed: true });
        // Update session to reflect onboarding completion
        await updateSession({ onboardingCompleted: true });
        // Clear localStorage
        localStorage.removeItem('medianest_onboarding');
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }, [updateState, updateSession]);

  // Skip onboarding
  const skipOnboarding = useCallback(async () => {
    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true, skipped: true }),
      });

      if (response.ok) {
        updateState({ completed: true, skipped: true });
        await updateSession({ onboardingCompleted: true });
        localStorage.removeItem('medianest_onboarding');
      }
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  }, [updateState, updateSession]);

  // Navigate to specific step
  const goToStep = useCallback((stepId: string) => {
    if (ONBOARDING_STEPS.includes(stepId)) {
      updateState({ currentStep: stepId });
    }
  }, [updateState]);

  // Navigate to next step
  const nextStep = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(state.currentStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      updateState({ currentStep: ONBOARDING_STEPS[currentIndex + 1] });
    }
  }, [state.currentStep, updateState]);

  // Navigate to previous step
  const previousStep = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(state.currentStep);
    if (currentIndex > 0) {
      updateState({ currentStep: ONBOARDING_STEPS[currentIndex - 1] });
    }
  }, [state.currentStep, updateState]);

  // Save progress data
  const saveProgress = useCallback((key: string, data: any) => {
    updateState({
      progress: { ...state.progress, [key]: data },
    });
  }, [state.progress, updateState]);

  // Reset onboarding (for testing/admin)
  const resetOnboarding = useCallback(async () => {
    setState(DEFAULT_STATE);
    localStorage.removeItem('medianest_onboarding');
    try {
      await fetch('/api/user/onboarding', {
        method: 'DELETE',
      });
      await updateSession({ onboardingCompleted: false });
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  }, [updateSession]);

  return {
    // State
    isLoading,
    isComplete: state.completed,
    isSkipped: state.skipped,
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    progress: state.progress,
    
    // Actions
    markStepComplete,
    skipOnboarding,
    completeOnboarding,
    goToStep,
    nextStep,
    previousStep,
    saveProgress,
    resetOnboarding,
  };
}