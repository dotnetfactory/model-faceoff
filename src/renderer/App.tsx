/**
 * Model Faceoff - Main App Component
 */

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { Settings as SettingsModal } from './components/Settings';
import { ModelComparison } from './components/ModelComparison';
import { ConversationHistory } from './components/ConversationHistory';
import { ApiLogs } from './components/ApiLogs';
import { Conversation, Message } from '../types/window';
import logoImage from './assets/logo.png';

type View = 'comparison' | 'history' | 'logs';

export interface LoadedConversation {
  conversation: Conversation;
  messages: Message[];
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<View>('comparison');
  const [loadedConversation, setLoadedConversation] = useState<LoadedConversation | null>(null);

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

  const handleLoadConversation = (conversation: Conversation, messages: Message[]) => {
    setLoadedConversation({ conversation, messages });
    setCurrentView('comparison');
  };

  const handleConversationLoaded = () => {
    // Clear loaded conversation after it's been restored
    setLoadedConversation(null);
  };

  const renderView = () => {
    switch (currentView) {
      case 'history':
        return (
          <ConversationHistory
            onBack={() => setCurrentView('comparison')}
            onLoadConversation={handleLoadConversation}
          />
        );
      case 'logs':
        return <ApiLogs onBack={() => setCurrentView('comparison')} />;
      case 'comparison':
      default:
        return (
          <ModelComparison
            onViewHistory={() => setCurrentView('history')}
            onViewLogs={() => setCurrentView('logs')}
            loadedConversation={loadedConversation}
            onConversationLoaded={handleConversationLoaded}
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
            <img src={logoImage} alt="Model Faceoff" className="app-logo-image" />
            <h1 className="app-title">Model Faceoff</h1>
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
