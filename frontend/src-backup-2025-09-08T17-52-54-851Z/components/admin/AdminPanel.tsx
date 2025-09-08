'use client';

import React, { useState } from 'react';
import { Settings, Users, Database, Activity } from 'lucide-react';

export interface AdminPanelProps {
  className?: string;
}

export function AdminPanel({ className = '' }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Total Users</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">1,234</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Active Sessions
                </h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">89</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">System Load</h3>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">67%</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-gray-600 dark:text-gray-400">
              User management interface would be implemented here.
            </p>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Database Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Database administration tools would be implemented here.
            </p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Settings</h2>
            <p className="text-gray-600 dark:text-gray-400">
              System configuration options would be implemented here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
