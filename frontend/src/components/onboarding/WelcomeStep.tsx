'use client';

import { motion } from 'framer-motion';
import { Sparkles, Film, Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  const features = [
    {
      icon: Film,
      title: 'Unified Media Management',
      description: 'Browse and manage all your Plex content in one place',
    },
    {
      icon: Users,
      title: 'Smart Requests',
      description: 'Request new movies and TV shows through Overseerr',
    },
    {
      icon: Download,
      title: 'YouTube Integration',
      description: 'Download and organize YouTube content for offline viewing',
    },
    {
      icon: Sparkles,
      title: 'Service Monitoring',
      description: 'Keep track of all your media services health',
    },
  ];

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
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-4xl font-bold text-white mb-4">Welcome to MediaNest</h2>
        <p className="text-xl text-gray-300 mb-2">Your unified media management platform</p>
        <p className="text-gray-400 max-w-2xl mx-auto">
          MediaNest brings together all your favorite media services in one beautiful, easy-to-use
          interface. Let's get you set up in just a few minutes!
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="bg-gray-700/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50"
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-700/50 rounded-lg flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center space-y-4"
      >
        <Button
          onClick={onNext}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3"
        >
          Get Started
          <Sparkles className="ml-2 h-5 w-5" />
        </Button>
        <p className="text-sm text-gray-500">This setup takes approximately 3-5 minutes</p>
      </motion.div>
    </div>
  );
}
