/**
 * ModelComparison - Main component for comparing AI models side by side
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Save, History, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { ModelPanel } from './ModelPanel';
import { ModelSelector } from './ModelSelector';
import { PresetManager } from './PresetManager';
import { OpenRouterModel, ChatMessage, StreamChunkData } from '../../../types/window';
import './ModelComparison.css';

interface PanelState {
  modelId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  currentResponse: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  } | null;
  latency_ms: number | null;
  error: string | null;
}

interface ModelComparisonProps {
  onViewHistory: () => void;
  onViewLogs: () => void;
}

export function ModelComparison({ onViewHistory, onViewLogs }: ModelComparisonProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const streamIdCounter = useRef(0);

  // Initialize 3 panels
  const [panels, setPanels] = useState<PanelState[]>([
    { modelId: null, messages: [], isStreaming: false, currentResponse: '', usage: null, latency_ms: null, error: null },
    { modelId: null, messages: [], isStreaming: false, currentResponse: '', usage: null, latency_ms: null, error: null },
    { modelId: null, messages: [], isStreaming: false, currentResponse: '', usage: null, latency_ms: null, error: null },
  ]);

  // Active stream IDs for each panel
  const activeStreamIds = useRef<(string | null)[]>([null, null, null]);

  // Load models on mount
  useEffect(() => {
    loadModels();
    loadLastSelection();
  }, []);

  // Setup stream listener
  useEffect(() => {
    const handleStreamChunk = (data: StreamChunkData) => {
      const panelIndex = activeStreamIds.current.findIndex((id) => id === data.streamId);
      if (panelIndex === -1) return;

      setPanels((prev) => {
        const newPanels = [...prev];
        const panel = { ...newPanels[panelIndex] };

        if (data.error) {
          panel.isStreaming = false;
          panel.error = data.error;
          activeStreamIds.current[panelIndex] = null;
        } else if (data.done) {
          panel.isStreaming = false;
          panel.usage = data.usage || null;
          panel.latency_ms = data.latency_ms || null;
          if (data.fullContent) {
            panel.messages = [...panel.messages, { role: 'assistant', content: data.fullContent }];
            panel.currentResponse = '';
          }
          activeStreamIds.current[panelIndex] = null;

          // Log the API call
          if (panel.modelId && data.usage) {
            // Use actual cost from OpenRouter if available, otherwise calculate (fallback)
            const model = models.find((m) => m.id === panel.modelId);
            const cost = data.usage.cost ?? (model
              ? calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens, model)
              : undefined);

            window.api.apiLogs.add({
              id: crypto.randomUUID(),
              conversation_id: conversationId || undefined,
              model_id: panel.modelId,
              provider: panel.modelId.split('/')[0],
              request_tokens: data.usage.prompt_tokens,
              response_tokens: data.usage.completion_tokens,
              total_tokens: data.usage.total_tokens,
              latency_ms: data.latency_ms || 0,
              cost,
              status: 'success',
            });

            // Save message to database
            if (conversationId) {
              window.api.messages.add({
                id: crypto.randomUUID(),
                conversation_id: conversationId,
                role: 'assistant',
                content: data.fullContent || '',
                model_id: panel.modelId,
                panel_index: panelIndex,
                tokens_prompt: data.usage.prompt_tokens,
                tokens_completion: data.usage.completion_tokens,
                latency_ms: data.latency_ms,
                cost,
              });
            }
          }
        } else {
          panel.currentResponse += data.content;
        }

        newPanels[panelIndex] = panel;
        return newPanels;
      });
    };

    window.api.openrouter.onStreamChunk(handleStreamChunk);
    return () => {
      window.api.openrouter.removeStreamListeners();
    };
  }, [models, conversationId]);

  const loadModels = async () => {
    setLoadingModels(true);
    const result = await window.api.openrouter.getModels();
    if (result.success && result.data) {
      setModels(result.data);
    } else if (result.error) {
      if (result.error.code === 'NO_API_KEY') {
        toast.error('Please configure your OpenRouter API key in Settings');
      } else {
        toast.error('Failed to load models: ' + result.error.message);
      }
    }
    setLoadingModels(false);
  };

  const loadLastSelection = async () => {
    const result = await window.api.settings.get('last_model_selection');
    if (result.success && result.data) {
      try {
        const savedModels = JSON.parse(result.data) as string[];
        setPanels((prev) =>
          prev.map((panel, i) => ({
            ...panel,
            modelId: savedModels[i] || null,
          }))
        );
      } catch {
        // Ignore parse errors
      }
    }
  };

  const saveLastSelection = async (modelIds: (string | null)[]) => {
    await window.api.settings.set('last_model_selection', JSON.stringify(modelIds));
  };

  const handleModelChange = (panelIndex: number, modelId: string | null) => {
    setPanels((prev) => {
      const newPanels = [...prev];
      newPanels[panelIndex] = { ...newPanels[panelIndex], modelId };
      saveLastSelection(newPanels.map((p) => p.modelId));
      return newPanels;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const activePanels = panels.filter((p) => p.modelId);
    if (activePanels.length === 0) {
      toast.error('Please select at least one model');
      return;
    }

    // Create conversation if doesn't exist
    let convId = conversationId;
    if (!convId) {
      convId = crypto.randomUUID();
      const modelIds = panels.map((p) => p.modelId).filter(Boolean) as string[];
      await window.api.conversations.create(convId, null, modelIds);
      setConversationId(convId);
    }

    // Save user message
    await window.api.messages.add({
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: 'user',
      content: prompt,
    });

    const userMessage: ChatMessage = { role: 'user', content: prompt };

    // Update all panels with user message and start streaming
    setPanels((prev) =>
      prev.map((panel) => ({
        ...panel,
        messages: panel.modelId ? [...panel.messages, userMessage] : panel.messages,
        isStreaming: panel.modelId ? true : false,
        currentResponse: '',
        usage: null,
        latency_ms: null,
        error: null,
      }))
    );

    setPrompt('');

    // Start streams for each panel with a model
    panels.forEach((panel, index) => {
      if (panel.modelId) {
        const streamId = `stream-${++streamIdCounter.current}`;
        activeStreamIds.current[index] = streamId;

        const allMessages: ChatMessage[] = [...panel.messages, userMessage];
        window.api.openrouter.startStream(streamId, panel.modelId, allMessages);
      }
    });
  };

  const handleStopAll = () => {
    activeStreamIds.current.forEach((streamId) => {
      if (streamId) {
        window.api.openrouter.stopStream(streamId);
      }
    });
    setPanels((prev) => prev.map((p) => ({ ...p, isStreaming: false })));
    activeStreamIds.current = [null, null, null];
  };

  const handleClearConversation = () => {
    setPanels((prev) =>
      prev.map((panel) => ({
        ...panel,
        messages: [],
        currentResponse: '',
        usage: null,
        latency_ms: null,
        error: null,
      }))
    );
    setConversationId(null);
  };

  const handleLoadPreset = (modelIds: string[]) => {
    setPanels((prev) =>
      prev.map((panel, i) => ({
        ...panel,
        modelId: modelIds[i] || null,
      }))
    );
    saveLastSelection(modelIds);
    setShowPresetManager(false);
  };

  const calculateCost = (promptTokens: number, completionTokens: number, model: OpenRouterModel): number => {
    const promptCost = (promptTokens / 1_000_000) * parseFloat(model.pricing.prompt);
    const completionCost = (completionTokens / 1_000_000) * parseFloat(model.pricing.completion);
    return promptCost + completionCost;
  };

  const isAnyStreaming = panels.some((p) => p.isStreaming);
  const hasAnyMessages = panels.some((p) => p.messages.length > 0);

  return (
    <div className="model-comparison">
      {/* Toolbar */}
      <div className="comparison-toolbar">
        <div className="toolbar-left">
          <button
            onClick={() => setShowPresetManager(true)}
            className="toolbar-button"
            title="Manage Presets"
          >
            <Save size={16} />
            <span>Presets</span>
          </button>
          <button onClick={onViewHistory} className="toolbar-button" title="View History">
            <History size={16} />
            <span>History</span>
          </button>
          <button onClick={onViewLogs} className="toolbar-button" title="View API Logs">
            <BarChart3 size={16} />
            <span>Logs</span>
          </button>
        </div>
        <div className="toolbar-right">
          {hasAnyMessages && (
            <button onClick={handleClearConversation} className="toolbar-button danger" disabled={isAnyStreaming}>
              <Trash2 size={16} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Panels */}
      <div className="panels-container">
        {panels.map((panel, index) => (
          <div key={index} className="panel-wrapper">
            <ModelSelector
              models={models}
              selectedModelId={panel.modelId}
              onSelectModel={(modelId) => handleModelChange(index, modelId)}
              loading={loadingModels}
              disabled={panel.isStreaming}
            />
            <ModelPanel
              messages={panel.messages}
              currentResponse={panel.currentResponse}
              isStreaming={panel.isStreaming}
              usage={panel.usage}
              latency_ms={panel.latency_ms}
              error={panel.error}
              model={models.find((m) => m.id === panel.modelId)}
            />
          </div>
        ))}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="input-area">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your message..."
          className="prompt-input"
          rows={3}
          disabled={isAnyStreaming}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <div className="input-actions">
          {isAnyStreaming ? (
            <button type="button" onClick={handleStopAll} className="stop-button">
              Stop All
            </button>
          ) : (
            <button type="submit" className="send-button" disabled={!prompt.trim()}>
              <Send size={18} />
              <span>Send to All</span>
            </button>
          )}
        </div>
      </form>

      {/* Preset Manager Modal */}
      {showPresetManager && (
        <PresetManager
          currentModels={panels.map((p) => p.modelId)}
          models={models}
          onLoadPreset={handleLoadPreset}
          onClose={() => setShowPresetManager(false)}
        />
      )}
    </div>
  );
}
