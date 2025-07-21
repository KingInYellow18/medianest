'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import WelcomeStep from './WelcomeStep';
import PlexSetupStep from './PlexSetupStep';
import ServicesOverview from './ServicesOverview';
import FeatureTour from './FeatureTour';
import { useOnboarding } from '@/hooks/useOnboarding';

const steps = [
  { id: 'welcome', title: 'Welcome', component: WelcomeStep },
  { id: 'plex-setup', title: 'Connect Plex', component: PlexSetupStep },
  { id: 'services', title: 'Discover Services', component: ServicesOverview },
  { id: 'features', title: 'Feature Tour', component: FeatureTour },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const {
    currentStep,
    isComplete,
    markStepComplete,
    skipOnboarding,
    goToStep,
    nextStep,
    previousStep,
    saveProgress,
  } = useOnboarding();

  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const CurrentStepComponent = steps[currentStepIndex]?.component;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    if (isComplete) {
      router.push('/dashboard');
    }
  }, [isComplete, router]);

  const handleSkip = async () => {
    await skipOnboarding();
    router.push('/dashboard');
  };

  const handleNext = async () => {
    await markStepComplete(currentStep);
    if (currentStepIndex === steps.length - 1) {
      // Complete onboarding
      await saveProgress({ completed: true });
      router.push('/dashboard');
    } else {
      nextStep();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      previousStep();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <img src="/images/medianest-logo.svg" alt="MediaNest" className="h-10 w-10" />
            <h1 className="text-2xl font-bold text-white">MediaNest Setup</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSkipConfirm(true)}
            className="text-gray-400 hover:text-white"
          >
            Skip Setup
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index !== steps.length - 1 ? 'flex-1' : ''}`}
              >
                <button
                  onClick={() => index <= currentStepIndex && goToStep(step.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    index < currentStepIndex
                      ? 'bg-green-600 text-white'
                      : index === currentStepIndex
                        ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
                        : 'bg-gray-700 text-gray-400'
                  }`}
                  disabled={index > currentStepIndex}
                >
                  {index < currentStepIndex ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>
                {index !== steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      index < currentStepIndex ? 'bg-green-600' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            {steps.map((step) => (
              <span key={step.id}>{step.title}</span>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-8 mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {CurrentStepComponent && <CurrentStepComponent onNext={handleNext} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className="text-gray-400 hover:text-white"
          >
            Previous
          </Button>
          <div className="flex items-center space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStepIndex
                    ? 'bg-blue-600 w-8'
                    : index < currentStepIndex
                      ? 'bg-green-600'
                      : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
            {currentStepIndex === steps.length - 1 ? 'Complete Setup' : 'Next'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Skip Confirmation Modal */}
      <AnimatePresence>
        {showSkipConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowSkipConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Skip Setup?</h3>
              <p className="text-gray-400 mb-6">
                You can always access the setup wizard later from your account settings. Are you
                sure you want to skip?
              </p>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1"
                >
                  Continue Setup
                </Button>
                <Button onClick={handleSkip} className="flex-1 bg-gray-700 hover:bg-gray-600">
                  Skip for Now
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
