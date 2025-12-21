/**
 * ShareDialog - Modal for sharing conversations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, ExternalLink, Clock, MessageSquare, Loader2 } from 'lucide-react';
import { Share } from '../../../types/window';
import './ShareDialog.css';

interface ShareDialogProps {
  conversationId: string;
  conversationTitle: string | null;
  onClose: () => void;
}

export function ShareDialog({ conversationId, conversationTitle, onClose }: ShareDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<Share[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const result = await window.api.share.getHistory(conversationId);
    if (result.success && result.data) {
      setHistory(result.data);
    }
    setLoadingHistory(false);
  }, [conversationId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleCreateShare = async () => {
    setIsCreating(true);
    setError(null);

    const result = await window.api.share.createShare(conversationId);

    if (result.success && result.data) {
      setNewShareUrl(result.data.shareUrl);
      // Reload history to show the new share
      loadHistory();
      // Auto-copy to clipboard
      await copyToClipboard(result.data.shareUrl, 'new');
    } else {
      setError(result.error?.message || 'Failed to create share');
    }

    setIsCreating(false);
  };

  const copyToClipboard = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openInBrowser = (url: string) => {
    window.api.shell.openExternal(url);
  };

  return (
    <div className="share-dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog-header">
          <h2>Share Conversation</h2>
          <button className="close-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="share-dialog-content">
          <p className="share-description">
            {conversationTitle || 'This conversation'} will be shared publicly. Anyone with the link can view it.
          </p>

          {/* New Share Section */}
          {newShareUrl ? (
            <div className="new-share-result">
              <div className="share-url-container">
                <input type="text" value={newShareUrl} readOnly className="share-url-input" />
                <button
                  className={`copy-button ${copiedId === 'new' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(newShareUrl, 'new')}
                >
                  {copiedId === 'new' ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button className="open-button" onClick={() => openInBrowser(newShareUrl)} title="Open in browser">
                  <ExternalLink size={16} />
                </button>
              </div>
              <p className="share-success">Link copied to clipboard!</p>
            </div>
          ) : (
            <button className="create-share-button" onClick={handleCreateShare} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  Creating share...
                </>
              ) : (
                'Create Share Link'
              )}
            </button>
          )}

          {error && <p className="share-error">{error}</p>}

          {/* Share History Section */}
          <div className="share-history-section">
            <h3>Previous Shares</h3>
            {loadingHistory ? (
              <p className="loading-history">Loading...</p>
            ) : history.length === 0 ? (
              <p className="no-history">No previous shares for this conversation.</p>
            ) : (
              <div className="share-history-list">
                {history.map((share) => (
                  <div key={share.id} className="share-history-item">
                    <div className="share-history-info">
                      <div className="share-history-meta">
                        <span className="share-date">
                          <Clock size={12} />
                          {formatDate(share.created_at)}
                        </span>
                        <span className="share-messages">
                          <MessageSquare size={12} />
                          {share.message_count} messages
                        </span>
                      </div>
                      <div className="share-history-url">{share.share_url}</div>
                    </div>
                    <div className="share-history-actions">
                      <button
                        className={`copy-button ${copiedId === share.id ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(share.share_url, share.id)}
                        title="Copy link"
                      >
                        {copiedId === share.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        className="open-button"
                        onClick={() => openInBrowser(share.share_url)}
                        title="Open in browser"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
