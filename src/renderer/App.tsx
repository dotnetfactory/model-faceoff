/**
 * AI Model Comparison Tool - Main App Component
 */

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { Settings as SettingsModal } from './components/Settings';
import { ModelComparison } from './components/ModelComparison';
import { ConversationHistory } from './components/ConversationHistory';
import { ApiLogs } from './components/ApiLogs';

type View = 'comparison' | 'history' | 'logs';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<View>('comparison');

  // Listen for auto-update events
  useEffect(() => {
    window.api.app.onUpdateAvailable((version) => {
      toast.info(`Update v${version} available, downloading...`);
    });

    window.api.app.onUpdateDownloaded((version) => {
      toast.success(`Update v${version} ready!`, {
        duration: Infinity,
        action: {
          label: 'Restart Now',
          onClick: () => window.api.app.quitAndInstall(),
        },
      });
    });

    return () => {
      window.api.app.removeUpdateListeners();
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'history':
        return <ConversationHistory onBack={() => setCurrentView('comparison')} />;
      case 'logs':
        return <ApiLogs onBack={() => setCurrentView('comparison')} />;
      case 'comparison':
      default:
        return (
          <ModelComparison
            onViewHistory={() => setCurrentView('history')}
            onViewLogs={() => setCurrentView('logs')}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">
            <h1 className="app-title">AI Model Comparison</h1>
          </div>
        </div>
        <div className="header-right">
          <button onClick={() => setShowSettings(true)} className="settings-button">
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">{renderView()}</main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Toast notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
