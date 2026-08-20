/**
 * Model Faceoff - Main App Component
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { Settings as SettingsModal } from './components/Settings';
import { ModelComparison } from './components/ModelComparison';
import { Sidebar } from './components/Sidebar';
import { ApiLogs } from './components/ApiLogs';
import { EmailGate } from './components/EmailGate/EmailGate';
import { Conversation, Message } from '../types/window';
import logoImage from './assets/logo.png';

type View = 'comparison' | 'logs';

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
// Two "Maybe later"s means never ask again. Settings still has a Verify email button.
const MAX_DECLINES = 2;
const NEVER = new Date('2100-01-01').getTime();

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
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  // Only the automatic first-run prompt counts toward the decline limit. Opening
  // the gate from Settings and backing out must not burn a decline, or a curious
  // user can silently turn the prompt off forever.
  const [emailGateAuto, setEmailGateAuto] = useState(false);
  const emailGateChecked = useRef(false);

  // Ask for an email once per install, unless it is verified or snoozed
  useEffect(() => {
    // StrictMode double-fires effects in dev, so only ever check once
    if (emailGateChecked.current) return;
    emailGateChecked.current = true;

    const checkEmailGate = async () => {
      const result = await window.api.settings.getAll();
      const settings = result.data;
      if (!settings) return;

      if (settings.email_verified_address) {
        setVerifiedEmail(settings.email_verified_address);
      }
      if (settings.email_verified) return;
      if (Number(settings.email_prompt_snooze_until || 0) > Date.now()) return;

      setEmailGateAuto(true);
      setShowEmailGate(true);
    };
    checkEmailGate();
  }, []);

  const handleEmailVerified = useCallback(async (email: string) => {
    setShowEmailGate(false);
    setVerifiedEmail(email);
    await window.api.settings.set('email_verified', '1');
    await window.api.settings.set('email_verified_address', email);
    toast.success('Email verified, thank you!');
  }, []);

  const handleEmailDismissed = useCallback(async () => {
    setShowEmailGate(false);
    if (!emailGateAuto) return;
    const result = await window.api.settings.get('email_prompt_declines');
    const declines = Number(result.data || 0) + 1;
    await window.api.settings.set('email_prompt_declines', String(declines));
    await window.api.settings.set(
      'email_prompt_snooze_until',
      String(declines >= MAX_DECLINES ? NEVER : Date.now() + SNOOZE_MS)
    );
  }, [emailGateAuto]);

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
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          verifiedEmail={verifiedEmail}
          onVerifyEmail={() => {
            setEmailGateAuto(false);
            setShowEmailGate(true);
          }}
        />
      )}

      {/* Email verification prompt */}
      {showEmailGate && <EmailGate onVerified={handleEmailVerified} onDismiss={handleEmailDismissed} />}

      {/* Toast notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
