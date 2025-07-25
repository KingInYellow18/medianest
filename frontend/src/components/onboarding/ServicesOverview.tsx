'use client';

import { motion } from 'framer-motion';
import { 
  Film, 
  Download, 
  Activity, 
  Search, 
  Users, 
  TrendingUp,
  Shield,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ServicesOverviewProps {
  onNext: () => void;
}

interface Service {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  features: string[];
  status: 'active' | 'coming-soon' | 'optional';
}

export default function ServicesOverview({ onNext }: ServicesOverviewProps) {
  const services: Service[] = [
    {
      id: 'plex',
      name: 'Plex Media Server',
      description: 'Your personal streaming service with all your media',
      icon: Film,
      color: 'text-orange-400',
      gradient: 'from-orange-500 to-yellow-600',
      features: ['Stream anywhere', 'Share with friends', 'Automatic organization'],
      status: 'active',
    },
    {
      id: 'overseerr',
      name: 'Overseerr',
      description: 'Request management for movies and TV shows',
      icon: Search,
      color: 'text-purple-400',
      gradient: 'from-purple-500 to-pink-600',
      features: ['Easy requests', 'Approval workflow', 'User management'],
      status: 'active',
    },
    {
      id: 'youtube',
      name: 'YouTube Downloader',
      description: 'Download and organize YouTube content for offline viewing',
      icon: Download,
      color: 'text-red-400',
      gradient: 'from-red-500 to-rose-600',
      features: ['Queue management', 'Format selection', 'Metadata preservation'],
      status: 'active',
    },
    {
      id: 'uptime-kuma',
      name: 'Uptime Kuma',
      description: 'Monitor the health of all your services',
      icon: Activity,
      color: 'text-green-400',
      gradient: 'from-green-500 to-emerald-600',
      features: ['Real-time monitoring', 'Notifications', 'Historical data'],
      status: 'optional',
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
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
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-6"
        >
          <Zap className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-3xl font-bold text-white mb-4">
          Powerful Services at Your Fingertips
        </h2>
        <p className="text-gray-300 max-w-2xl mx-auto">
          MediaNest integrates with your favorite media services to create a seamless experience.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {services.map((service) => (
          <motion.div
            key={service.id}
            variants={item}
            className="bg-gray-700/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all hover:shadow-lg hover:shadow-black/20"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 bg-gradient-to-br ${service.gradient} rounded-lg flex items-center justify-center`}>
                  <service.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {service.name}
                  </h3>
                  {service.status === 'coming-soon' && (
                    <Badge variant="secondary" className="mt-1">
                      Coming Soon
                    </Badge>
                  )}
                  {service.status === 'optional' && (
                    <Badge variant="outline" className="mt-1 text-gray-400">
                      Optional
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-4">{service.description}</p>

            <div className="space-y-2">
              {service.features.map((feature, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${service.color} bg-current`} />
                  <span className="text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-6 border border-blue-700/30"
      >
        <div className="flex items-start space-x-4">
          <Shield className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Privacy & Security First
            </h3>
            <p className="text-gray-300 text-sm">
              All your services run locally on your network. Your data never leaves your control, 
              and you decide who has access to what. MediaNest is just the friendly interface 
              that brings everything together.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex flex-col items-center space-y-4"
      >
        <Button
          onClick={onNext}
          size="lg"
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3"
        >
          Continue to Feature Tour
          <TrendingUp className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
}