/**
 * Sidebar - Conversation history sidebar (ChatGPT-style)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, MessageSquare, Trash2, Clock, Pencil, Check, X } from 'lucide-react';
import { Conversation, Message } from '../../../types/window';
import './Sidebar.css';

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation, messages: Message[]) => void;
  onNewConversation: () => void;
  refreshTrigger?: number;
}

export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  refreshTrigger,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    const result = await window.api.conversations.getAll();
    if (result.success && result.data) {
      setConversations(result.data as Conversation[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshTrigger]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSelectConversation = async (conversation: Conversation) => {
    if (conversation.id === currentConversationId || editingId) return;

    const result = await window.api.conversations.get(conversation.id);
    if (result.success && result.data) {
      onSelectConversation(
        result.data.conversation as Conversation,
        result.data.messages as Message[]
      );
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await window.api.conversations.delete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);

    // If we deleted the current conversation, start a new one
    if (id === currentConversationId) {
      onNewConversation();
    }
  };

  const handleStartEdit = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditingTitle(conversation.title || '');
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const handleSaveEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingId) return;

    const trimmedTitle = editingTitle.trim();
    if (trimmedTitle) {
      await window.api.conversations.updateTitle(editingId, trimmedTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, title: trimmedTitle } : c))
      );
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditingTitle(conversation.title || '');
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Group conversations by date
  const groupedConversations = conversations.reduce<Record<string, Conversation[]>>(
    (groups, conv) => {
      const dateKey = formatDate(conv.updated_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(conv);
      return groups;
    },
    {}
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-button" onClick={onNewConversation}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="sidebar-loading">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="sidebar-empty">
            <MessageSquare size={24} />
            <p>No conversations yet</p>
          </div>
        ) : (
          Object.entries(groupedConversations).map(([dateGroup, convs]) => (
            <div key={dateGroup} className="conversation-group">
              <div className="conversation-group-header">
                <Clock size={12} />
                <span>{dateGroup}</span>
              </div>
              {convs.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${
                    conversation.id === currentConversationId ? 'active' : ''
                  } ${deletingId === conversation.id ? 'deleting' : ''} ${
                    editingId === conversation.id ? 'editing' : ''
                  }`}
                  onClick={() => handleSelectConversation(conversation)}
                  onDoubleClick={(e) => handleDoubleClick(e, conversation)}
                >
                  <MessageSquare size={14} className="conversation-icon" />

                  {editingId === conversation.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="conversation-title-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={() => handleSaveEdit()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="conversation-title">
                      {conversation.title || 'Untitled'}
                    </span>
                  )}

                  <div className="conversation-actions">
                    {editingId === conversation.id ? (
                      <>
                        <button
                          className="action-button save"
                          onClick={handleSaveEdit}
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="action-button cancel"
                          onClick={handleCancelEdit}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="action-button edit"
                          onClick={(e) => handleStartEdit(e, conversation)}
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="action-button delete"
                          onClick={(e) => handleDelete(e, conversation.id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
