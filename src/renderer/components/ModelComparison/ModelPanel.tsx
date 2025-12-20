/**
 * ModelPanel - Displays messages and streaming responses for a single model
 */

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, Clock, Coins, Hash } from 'lucide-react';
import { ChatMessage, OpenRouterModel } from '../../../types/window';

interface ModelPanelProps {
  messages: ChatMessage[];
  currentResponse: string;
  isStreaming: boolean;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  } | null;
  latency_ms: number | null;
  error: string | null;
  model?: OpenRouterModel;
}

export function ModelPanel({
  messages,
  currentResponse,
  isStreaming,
  usage,
  latency_ms,
  error,
  model,
}: ModelPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  const formatCost = (cost: number): string => {
    if (cost < 0.0001) return '<$0.0001';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
  };

  const getCost = (): number | null => {
    if (!usage) return null;
    // Use actual cost from OpenRouter if available
    if (usage.cost !== undefined) return usage.cost;
    // Fallback to calculation if model pricing is available
    if (!model) return null;
    const promptCost = (usage.prompt_tokens / 1_000_000) * parseFloat(model.pricing.prompt);
    const completionCost = (usage.completion_tokens / 1_000_000) * parseFloat(model.pricing.completion);
    return promptCost + completionCost;
  };

  const cost = getCost();

  return (
    <div className="model-panel">
      <div className="panel-content" ref={scrollRef}>
        {messages.length === 0 && !currentResponse && !isStreaming && (
          <div className="panel-empty">
            {model ? (
              <p>Send a message to start the conversation</p>
            ) : (
              <p>Select a model to begin</p>
            )}
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-role">{message.role === 'user' ? 'You' : model?.name || 'Assistant'}</div>
            <div className="message-content">
              {message.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {(isStreaming || currentResponse) && (
          <div className="message assistant streaming">
            <div className="message-role">{model?.name || 'Assistant'}</div>
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentResponse || ' '}</ReactMarkdown>
              {isStreaming && <span className="cursor-blink">|</span>}
            </div>
          </div>
        )}

        {error && (
          <div className="panel-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Metrics Footer */}
      {(usage || latency_ms) && (
        <div className="panel-metrics">
          {latency_ms !== null && (
            <div className="metric">
              <Clock size={12} />
              <span>{(latency_ms / 1000).toFixed(2)}s</span>
            </div>
          )}
          {usage && (
            <div className="metric">
              <Hash size={12} />
              <span>{usage.total_tokens} tokens</span>
            </div>
          )}
          {cost !== null && (
            <div className="metric">
              <Coins size={12} />
              <span>{formatCost(cost)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
