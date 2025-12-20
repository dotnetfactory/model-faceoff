/**
 * ModelComparison - Main component for comparing AI models side by side
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Save, History, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { ModelPanel } from './ModelPanel';
import { ModelSelector } from './ModelSelector';
import { PresetManager } from './PresetManager';
import { OpenRouterModel, ChatMessage, StreamChunkData, Message } from '../../../types/window';
import { LoadedConversation } from '../../App';
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
  loadedConversation?: LoadedConversation | null;
  onConversationLoaded?: () => void;
}

export function ModelComparison({ onViewHistory, onViewLogs, loadedConversation, onConversationLoaded }: ModelComparisonProps) {
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
  // Track which streams have been logged to prevent duplicates
  const loggedStreamIds = useRef<Set<string>>(new Set());
  // Map streamId to modelId for logging (since panel state may change)
  const streamModelMap = useRef<Map<string, string>>(new Map());
  // Track if title has been generated for current conversation
  const titleGenerated = useRef(false);
  // Store the first user message for title generation
  const firstUserMessage = useRef<string | null>(null);
  // Track expected stream count for first exchange
  const expectedStreams = useRef(0);
  const completedStreams = useRef(0);

  // Load models on mount
  useEffect(() => {
    loadModels();
    loadLastSelection();
  }, []);

  // Restore loaded conversation
  useEffect(() => {
    if (!loadedConversation || models.length === 0) return;

    const { conversation, messages } = loadedConversation;

    // Parse model IDs from conversation
    let modelIds: string[] = [];
    try {
      modelIds = JSON.parse(conversation.models);
    } catch {
      toast.error('Failed to parse conversation models');
      return;
    }

    // Group messages by panel_index for assistant messages
    // User messages are shared across all panels
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessagesByPanel = new Map<number, Message[]>();

    messages
      .filter((m) => m.role === 'assistant' && m.panel_index !== null)
      .forEach((m) => {
        const panelMessages = assistantMessagesByPanel.get(m.panel_index!) || [];
        panelMessages.push(m);
        assistantMessagesByPanel.set(m.panel_index!, panelMessages);
      });

    // Build chat messages for each panel by interleaving user and assistant messages
    const newPanels: PanelState[] = modelIds.slice(0, 3).map((modelId, index) => {
      const panelAssistantMessages = assistantMessagesByPanel.get(index) || [];
      const chatMessages: ChatMessage[] = [];

      // Interleave user messages with this panel's assistant responses
      userMessages.forEach((userMsg, userIndex) => {
        chatMessages.push({ role: 'user', content: userMsg.content });
        // Find the assistant message that corresponds to this user message
        const assistantMsg = panelAssistantMessages[userIndex];
        if (assistantMsg) {
          chatMessages.push({ role: 'assistant', content: assistantMsg.content });
        }
      });

      return {
        modelId,
        messages: chatMessages,
        isStreaming: false,
        currentResponse: '',
        usage: null,
        latency_ms: null,
        error: null,
      };
    });

    // Pad with empty panels if needed
    while (newPanels.length < 3) {
      newPanels.push({
        modelId: null,
        messages: [],
        isStreaming: false,
        currentResponse: '',
        usage: null,
        latency_ms: null,
        error: null,
      });
    }

    // Set state
    setConversationId(conversation.id);
    setPanels(newPanels);

    // Mark title as already generated for loaded conversations
    titleGenerated.current = true;
    firstUserMessage.current = null;

    // Notify parent that conversation has been loaded
    onConversationLoaded?.();
    toast.success('Conversation loaded');
  }, [loadedConversation, models, onConversationLoaded]);

  // Setup stream listener
  useEffect(() => {
    const handleStreamChunk = (data: StreamChunkData) => {
      const panelIndex = activeStreamIds.current.findIndex((id) => id === data.streamId);
      if (panelIndex === -1) return;

      // Handle completion logging outside of state updater to prevent duplicates
      if (data.done && !loggedStreamIds.current.has(data.streamId)) {
        loggedStreamIds.current.add(data.streamId);

        // Get modelId from our ref map (set when stream was started)
        const modelId = streamModelMap.current.get(data.streamId);

        if (modelId && data.usage) {
          const model = models.find((m) => m.id === modelId);
          const cost = data.usage.cost ?? (model
            ? calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens, model)
            : undefined);

          // Log the API call
          window.api.apiLogs.add({
            id: crypto.randomUUID(),
            conversation_id: conversationId || undefined,
            model_id: modelId,
            provider: modelId.split('/')[0],
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
              model_id: modelId,
              panel_index: panelIndex,
              tokens_prompt: data.usage.prompt_tokens,
              tokens_completion: data.usage.completion_tokens,
              latency_ms: data.latency_ms,
              cost,
            });
          }

          // Clean up the map entry
          streamModelMap.current.delete(data.streamId);

          // Track stream completion for title generation
          completedStreams.current++;

          // Generate title after first exchange completes (all streams done)
          if (
            !titleGenerated.current &&
            firstUserMessage.current &&
            conversationId &&
            completedStreams.current >= expectedStreams.current
          ) {
            titleGenerated.current = true;
            const userMsg = firstUserMessage.current;
            const convId = conversationId;

            // Generate title asynchronously
            window.api.openrouter.generateTitle(userMsg).then((result) => {
              if (result.success && result.data) {
                window.api.conversations.updateTitle(convId, result.data);
              }
            });
          }
        }
      }

      // Update panel state (pure function)
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

      // Set up title generation for new conversation
      firstUserMessage.current = prompt;
      titleGenerated.current = false;
      expectedStreams.current = panels.filter((p) => p.modelId).length;
      completedStreams.current = 0;
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
        // Store modelId for this stream so we can use it when logging completion
        streamModelMap.current.set(streamId, panel.modelId);

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
    // Reset title generation state
    titleGenerated.current = false;
    firstUserMessage.current = null;
    expectedStreams.current = 0;
    completedStreams.current = 0;
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
              disabled={panel.isStreaming || panel.messages.length > 0}
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
