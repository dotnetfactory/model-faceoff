/**
 * ConversationHistory - View and manage past conversations
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, MessageSquare, Calendar, Clock, Play } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Conversation, Message } from '../../../types/window';
import './ConversationHistory.css';

interface ConversationHistoryProps {
  onBack: () => void;
  onLoadConversation: (conversation: Conversation, messages: Message[]) => void;
}

export function ConversationHistory({ onBack, onLoadConversation }: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    const result = await window.api.conversations.getAll();
    if (result.success && result.data) {
      setConversations(result.data);
    }
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    const result = await window.api.conversations.get(conversationId);
    if (result.success && result.data) {
      setMessages(result.data.messages);
    }
    setLoadingMessages(false);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;

    const result = await window.api.conversations.delete(id);
    if (result.success) {
      toast.success('Conversation deleted');
      if (selectedConversation?.id === id) {
        setSelectedConversation(null);
        setMessages([]);
      }
      loadConversations();
    } else {
      toast.error('Failed to delete conversation');
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConversationTitle = (conv: Conversation): string => {
    if (conv.title) return conv.title;
    return `Conversation from ${formatDate(conv.created_at)}`;
  };

  const getModels = (conv: Conversation): string[] => {
    try {
      return JSON.parse(conv.models);
    } catch {
      return [];
    }
  };

  const handleContinueConversation = () => {
    if (selectedConversation && messages.length > 0) {
      onLoadConversation(selectedConversation, messages);
    }
  };

  // Group messages by user prompt (each user message + all assistant responses)
  const groupedMessages = messages.reduce<{ userMessage: Message; responses: Message[] }[]>((acc, msg) => {
    if (msg.role === 'user') {
      acc.push({ userMessage: msg, responses: [] });
    } else if (acc.length > 0) {
      acc[acc.length - 1].responses.push(msg);
    }
    return acc;
  }, []);

  return (
    <div className="conversation-history">
      {/* Header */}
      <div className="history-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1>Conversation History</h1>
      </div>

      <div className="history-content">
        {/* Conversation List */}
        <div className="conversation-list">
          {loading ? (
            <div className="loading-state">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={32} />
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
                onClick={() => handleSelectConversation(conv)}
              >
                <div className="conversation-info">
                  <span className="conversation-title">{getConversationTitle(conv)}</span>
                  <div className="conversation-meta">
                    <span className="conversation-date">
                      <Calendar size={12} />
                      {formatDate(conv.created_at)}
                    </span>
                    <span className="conversation-models">{getModels(conv).length} models</span>
                  </div>
                </div>
                <button
                  className="delete-button"
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  title="Delete conversation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Conversation Detail */}
        <div className="conversation-detail">
          {!selectedConversation ? (
            <div className="empty-state">
              <MessageSquare size={48} />
              <p>Select a conversation to view</p>
            </div>
          ) : loadingMessages ? (
            <div className="loading-state">Loading messages...</div>
          ) : (
            <div className="messages-view">
              <div className="conversation-header">
                <div className="conversation-header-info">
                  <h2>{getConversationTitle(selectedConversation)}</h2>
                  <div className="models-used">
                    {getModels(selectedConversation).map((model, i) => (
                      <span key={i} className="model-tag">
                        {model.split('/').pop()}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="continue-button" onClick={handleContinueConversation}>
                  <Play size={16} />
                  <span>Continue</span>
                </button>
              </div>

              <div className="messages-list">
                {groupedMessages.map((group, groupIndex) => (
                  <div key={groupIndex} className="message-group">
                    {/* User Message */}
                    <div className="message user-message">
                      <div className="message-header">
                        <span className="message-role">You</span>
                        <span className="message-time">
                          <Clock size={12} />
                          {formatTime(group.userMessage.created_at)}
                        </span>
                      </div>
                      <div className="message-content">{group.userMessage.content}</div>
                    </div>

                    {/* Assistant Responses */}
                    <div className="responses-grid">
                      {group.responses.map((response) => (
                        <div key={response.id} className="message assistant-message">
                          <div className="message-header">
                            <span className="message-role">{response.model_id?.split('/').pop() || 'Assistant'}</span>
                            {response.latency_ms && (
                              <span className="message-latency">{(response.latency_ms / 1000).toFixed(2)}s</span>
                            )}
                          </div>
                          <div className="message-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.content}</ReactMarkdown>
                          </div>
                          {response.tokens_completion && (
                            <div className="message-stats">
                              <span>{response.tokens_completion} tokens</span>
                              {response.cost && <span>${response.cost.toFixed(4)}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
