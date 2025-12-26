/**
 * Model Faceoff - Preload Script
 *
 * Exposes the API to the renderer process via contextBridge.
 * This file runs in a sandboxed context with access to Node.js APIs.
 *
 * Add your own APIs following the pattern below.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Settings API
const settingsAPI = {
  get: (key: string) => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAll: () => ipcRenderer.invoke('settings:getAll'),
};

// Dialog API
const dialogAPI = {
  showSaveDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),
};

// Shell API
const shellAPI = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
};

// Database API
const databaseAPI = {
  getInfo: () => ipcRenderer.invoke('database:getInfo'),
  migrateToDocuments: () => ipcRenderer.invoke('database:migrateToDocuments'),
  showInFinder: () => ipcRenderer.invoke('database:showInFinder'),
  selectExisting: () => ipcRenderer.invoke('database:selectExisting'),
};

// App API
const appAPI = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update:available', (_, version) => callback(version));
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update:downloaded', (_, version) => callback(version));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update:available');
    ipcRenderer.removeAllListeners('update:downloaded');
  },
};

// OpenRouter API
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamChunkData {
  streamId: string;
  content: string;
  done: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms?: number;
  fullContent?: string;
  error?: string;
}

const openrouterAPI = {
  getModels: () => ipcRenderer.invoke('openrouter:getModels'),
  clearModelsCache: () => ipcRenderer.invoke('openrouter:clearModelsCache'),
  getApiKeyStatus: () => ipcRenderer.invoke('openrouter:getApiKeyStatus'),
  startStream: (streamId: string, model: string, messages: ChatMessage[]) =>
    ipcRenderer.invoke('openrouter:startStream', streamId, model, messages),
  stopStream: (streamId: string) => ipcRenderer.invoke('openrouter:stopStream', streamId),
  generateTitle: (userMessage: string) => ipcRenderer.invoke('openrouter:generateTitle', userMessage),
  onStreamChunk: (callback: (data: StreamChunkData) => void) => {
    // Remove any existing listeners first to prevent duplicates
    ipcRenderer.removeAllListeners('openrouter:streamChunk');
    ipcRenderer.on('openrouter:streamChunk', (_, data) => callback(data));
  },
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('openrouter:streamChunk');
  },
};

// Presets API
const presetsAPI = {
  getAll: () => ipcRenderer.invoke('presets:getAll'),
  save: (id: string, name: string, models: string[]) => ipcRenderer.invoke('presets:save', id, name, models),
  delete: (id: string) => ipcRenderer.invoke('presets:delete', id),
};

// Conversations API
const conversationsAPI = {
  getAll: () => ipcRenderer.invoke('conversations:getAll'),
  get: (id: string) => ipcRenderer.invoke('conversations:get', id),
  create: (id: string, title: string | null, models: string[]) =>
    ipcRenderer.invoke('conversations:create', id, title, models),
  updateTitle: (id: string, title: string) => ipcRenderer.invoke('conversations:updateTitle', id, title),
  delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
};

// Messages API
interface MessageData {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model_id?: string;
  panel_index?: number;
  tokens_prompt?: number;
  tokens_completion?: number;
  latency_ms?: number;
  cost?: number;
}

const messagesAPI = {
  add: (messageData: MessageData) => ipcRenderer.invoke('messages:add', messageData),
};

// API Logs API
interface ApiLogData {
  id: string;
  conversation_id?: string;
  model_id: string;
  provider?: string;
  request_tokens?: number;
  response_tokens?: number;
  total_tokens?: number;
  latency_ms: number;
  cost?: number;
  status: string;
  error_message?: string;
}

const apiLogsAPI = {
  add: (logData: ApiLogData) => ipcRenderer.invoke('apiLogs:add', logData),
  getAll: (limit?: number, offset?: number) => ipcRenderer.invoke('apiLogs:getAll', limit, offset),
  getStats: () => ipcRenderer.invoke('apiLogs:getStats'),
  getByModel: () => ipcRenderer.invoke('apiLogs:getByModel'),
};

// Share API
const shareAPI = {
  createShare: (conversationId: string) => ipcRenderer.invoke('share:createShare', conversationId),
  getHistory: (conversationId: string) => ipcRenderer.invoke('share:getHistory', conversationId),
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('api', {
  settings: settingsAPI,
  dialog: dialogAPI,
  shell: shellAPI,
  database: databaseAPI,
  app: appAPI,
  openrouter: openrouterAPI,
  presets: presetsAPI,
  conversations: conversationsAPI,
  messages: messagesAPI,
  apiLogs: apiLogsAPI,
  share: shareAPI,
});
