/**
 * Model Faceoff - Main App Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { Settings as SettingsModal } from './components/Settings';
import { ModelComparison } from './components/ModelComparison';
import { Sidebar } from './components/Sidebar';
import { ApiLogs } from './components/ApiLogs';
import { Conversation, Message } from '../types/window';
import logoImage from './assets/logo.png';

type View = 'comparison' | 'logs';

export interface LoadedConversation {
  conversation: Conversation;
  messages: Message[];
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<View>('comparison');
  const [loadedConversation, setLoadedConversation] = useState<LoadedConversation | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [newChatTrigger, setNewChatTrigger] = useState(0);

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

  const handleSelectConversation = useCallback((conversation: Conversation, messages: Message[]) => {
    setLoadedConversation({ conversation, messages });
    setCurrentConversationId(conversation.id);
    setCurrentView('comparison');
  }, []);

  const handleNewConversation = useCallback(() => {
    setLoadedConversation(null);
    setCurrentConversationId(null);
    setNewChatTrigger((prev) => prev + 1);
  }, []);

  const handleConversationLoaded = useCallback(() => {
    // Clear loaded conversation after it's been restored
    setLoadedConversation(null);
  }, []);

  const handleConversationChanged = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
    // Trigger sidebar refresh
    setSidebarRefreshTrigger((prev) => prev + 1);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'logs':
        return <ApiLogs onBack={() => setCurrentView('comparison')} />;
      case 'comparison':
      default:
        return (
          <ModelComparison
            onViewLogs={() => setCurrentView('logs')}
            loadedConversation={loadedConversation}
            onConversationLoaded={handleConversationLoaded}
            onConversationChanged={handleConversationChanged}
            newChatTrigger={newChatTrigger}
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

      {/* Main Content with Sidebar */}
      <div className="app-body">
        <Sidebar
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          refreshTrigger={sidebarRefreshTrigger}
        />
        <main className="app-main">{renderView()}</main>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Toast notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
