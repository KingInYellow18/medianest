'use client';

import React, { useState } from 'react';
import { Save, RefreshCw, Bell, Lock, Palette, Globe } from 'lucide-react';

export interface SettingsPanelProps {
  className?: string;
}

export function SettingsPanel({ className = '' }: SettingsPanelProps) {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoRefresh: true,
    language: 'en',
    privacy: 'public',
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    console.log('Saving settings:', settings);
    // Implementation would save to backend
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications</p>
            </div>
          </div>
          <button
            onClick={() => handleSettingChange('notifications', !settings.notifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.notifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Dark Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Palette className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Toggle dark theme</p>
            </div>
          </div>
          <button
            onClick={() => handleSettingChange('darkMode', !settings.darkMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.darkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Auto Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Auto Refresh</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatically refresh data</p>
            </div>
          </div>
          <button
            onClick={() => handleSettingChange('autoRefresh', !settings.autoRefresh)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoRefresh ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Language</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select your language</p>
            </div>
          </div>
          <select
            value={settings.language}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        {/* Privacy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Privacy</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Profile visibility</p>
            </div>
          </div>
          <select
            value={settings.privacy}
            onChange={(e) => handleSettingChange('privacy', e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="public">Public</option>
            <option value="friends">Friends Only</option>
            <option value="private">Private</option>
          </select>
        </div>

        {/* Save Button */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
