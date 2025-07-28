'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  Download,
  BarChart3,
  Smartphone,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeatureTourProps {
  onNext: () => void;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: any;
  preview: string;
  tips: string[];
}

export default function FeatureTour({ onNext }: FeatureTourProps) {
  const [currentFeature, setCurrentFeature] = useState(0);

  const features: Feature[] = [
    {
      id: 'search',
      title: 'Universal Search',
      description: 'Find any movie or show across all your services with one search',
      icon: Search,
      preview: '/images/features/search-preview.png',
      tips: [
        'Use filters to narrow down results',
        'Search by genre, year, or rating',
        'Save your favorite searches',
      ],
    },
    {
      id: 'requests',
      title: 'Smart Requests',
      description: 'Request new content and track its status in real-time',
      icon: Users,
      preview: '/images/features/requests-preview.png',
      tips: [
        'See availability before requesting',
        'Get notified when content is ready',
        'View request history and status',
      ],
    },
    {
      id: 'youtube',
      title: 'YouTube Collections',
      description: 'Download playlists and channels for offline viewing',
      icon: Download,
      preview: '/images/features/youtube-preview.png',
      tips: [
        'Queue multiple downloads',
        'Choose quality and format',
        'Automatic metadata extraction',
      ],
    },
    {
      id: 'monitoring',
      title: 'Service Health',
      description: 'Monitor all your services from one dashboard',
      icon: BarChart3,
      preview: '/images/features/monitoring-preview.png',
      tips: [
        'Real-time status updates',
        'Historical uptime data',
        'Service restart controls',
      ],
    },
    {
      id: 'mobile',
      title: 'Mobile Ready',
      description: 'Access MediaNest from any device, anywhere',
      icon: Smartphone,
      preview: '/images/features/mobile-preview.png',
      tips: [
        'Responsive design for all screens',
        'Touch-optimized controls',
        'Same features on mobile',
      ],
    },
  ];

  const currentFeatureData = features[currentFeature];
  const progress = ((currentFeature + 1) / features.length) * 100;

  const nextFeature = () => {
    if (currentFeature < features.length - 1) {
      setCurrentFeature(currentFeature + 1);
    }
  };

  const previousFeature = () => {
    if (currentFeature > 0) {
      setCurrentFeature(currentFeature - 1);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-full mb-6"
        >
          <Zap className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-3xl font-bold text-white mb-4">
          Discover Key Features
        </h2>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Let's take a quick tour of MediaNest's most powerful features
        </p>
      </motion.div>

      {/* Progress Indicators */}
      <div className="flex items-center justify-center space-x-2">
        {features.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentFeature(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentFeature
                ? 'bg-green-500 w-8'
                : index < currentFeature
                ? 'bg-green-600'
                : 'bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Feature Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentFeatureData.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-gray-700/30 backdrop-blur-sm rounded-lg overflow-hidden border border-gray-700/50"
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature Info */}
            <div className="p-8 space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <currentFeatureData.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {currentFeatureData.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Feature {currentFeature + 1} of {features.length}
                  </p>
                </div>
              </div>

              <p className="text-gray-300 text-lg">
                {currentFeatureData.description}
              </p>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Pro Tips
                </h4>
                {currentFeatureData.tips.map((tip, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-start space-x-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{tip}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Feature Preview */}
            <div className="relative bg-gray-800/50 flex items-center justify-center p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 to-teal-900/20" />
              <div className="relative">
                {/* Placeholder for feature preview */}
                <div className="w-full h-64 bg-gray-700/50 rounded-lg flex items-center justify-center">
                  <currentFeatureData.icon className="w-20 h-20 text-gray-600" />
                </div>
                <p className="text-center text-sm text-gray-500 mt-4">
                  Feature preview coming soon
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-gray-800/30 px-8 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={previousFeature}
              disabled={currentFeature === 0}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                {currentFeature + 1} / {features.length}
              </span>
            </div>

            {currentFeature < features.length - 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={nextFeature}
                className="text-gray-400 hover:text-white"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onNext}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Complete Tour
                <CheckCircle2 className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Skip Option */}
      {currentFeature < features.length - 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <button
            onClick={onNext}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip tour and finish setup
          </button>
        </motion.div>
      )}
    </div>
  );
}