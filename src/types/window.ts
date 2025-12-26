/**
 * Window API Types
 *
 * Type definitions for the window.api object exposed via preload.
 * Add your own API types following the pattern below.
 */

export interface IPCError {
  message: string;
  code?: string;
}

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: IPCError;
}

/**
 * Settings API exposed to renderer process
 */
export interface SettingsAPI {
  get: (key: string) => Promise<IPCResponse<string | null>>;
  set: (key: string, value: string) => Promise<IPCResponse<void>>;
  getAll: () => Promise<IPCResponse<Record<string, string>>>;
}

/**
 * Dialog API for native dialogs
 */
export interface DialogAPI {
  showSaveDialog: (options?: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | undefined>;
  showOpenDialog: (options?: {
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }) => Promise<string[] | undefined>;
}

/**
 * Shell API for external operations
 */
export interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<void>;
}

/**
 * Database location info
 */
export interface DatabaseInfo {
  currentPath: string;
  isLegacyLocation: boolean;
  canMigrate: boolean;
  legacyPath: string;
  defaultPath: string;
}

/**
 * Database API for managing database location
 */
export interface DatabaseAPI {
  getInfo: () => Promise<IPCResponse<DatabaseInfo>>;
  migrateToDocuments: () => Promise<IPCResponse<{ oldPath: string; newPath: string }>>;
  showInFinder: () => Promise<IPCResponse<void>>;
  selectExisting: () => Promise<IPCResponse<{ newPath: string }>>;
}

/**
 * App API for application information
 */
export interface AppAPI {
  getVersion: () => Promise<IPCResponse<string>>;
  quitAndInstall: () => Promise<IPCResponse<void>>;
  onUpdateAvailable: (callback: (version: string) => void) => void;
  onUpdateDownloaded: (callback: (version: string) => void) => void;
  removeUpdateListeners: () => void;
}

/**
 * OpenRouter Model
 */
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

/**
 * Chat message for OpenRouter
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Stream chunk data
 */
export interface StreamChunkData {
  streamId: string;
  content: string;
  done: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    // Native token counts (used for actual billing)
    native_tokens_prompt?: number;
    native_tokens_completion?: number;
    native_tokens_reasoning?: number;
    // Actual cost from OpenRouter
    cost?: number;
  };
  latency_ms?: number;
  fullContent?: string;
  error?: string;
}

/**
 * API Key Status
 */
export interface ApiKeyStatus {
  hasApiKey: boolean;
  isFreeMode: boolean;
}

/**
 * Get Models Response (includes isFreeMode flag)
 */
export interface GetModelsResponse {
  data?: OpenRouterModel[];
  isFreeMode?: boolean;
}

/**
 * OpenRouter API
 */
export interface OpenRouterAPI {
  getModels: () => Promise<IPCResponse<OpenRouterModel[]> & { isFreeMode?: boolean }>;
  clearModelsCache: () => Promise<IPCResponse<void>>;
  getApiKeyStatus: () => Promise<IPCResponse<ApiKeyStatus>>;
  startStream: (streamId: string, model: string, messages: ChatMessage[]) => Promise<IPCResponse<{ streamId: string }>>;
  stopStream: (streamId: string) => Promise<IPCResponse<void>>;
  generateTitle: (userMessage: string) => Promise<IPCResponse<string>>;
  onStreamChunk: (callback: (data: StreamChunkData) => void) => void;
  removeStreamListeners: () => void;
}

/**
 * Preset
 */
export interface Preset {
  id: string;
  name: string;
  models: string;
  created_at: number;
  updated_at: number;
}

/**
 * Presets API
 */
export interface PresetsAPI {
  getAll: () => Promise<IPCResponse<Preset[]>>;
  save: (id: string, name: string, models: string[]) => Promise<IPCResponse<void>>;
  delete: (id: string) => Promise<IPCResponse<void>>;
}

/**
 * Conversation
 */
export interface Conversation {
  id: string;
  title: string | null;
  models: string;
  created_at: number;
  updated_at: number;
}

/**
 * Message
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model_id: string | null;
  panel_index: number | null;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  latency_ms: number | null;
  cost: number | null;
  created_at: number;
}

/**
 * Message data for adding
 */
export interface MessageData {
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

/**
 * Conversations API
 */
export interface ConversationsAPI {
  getAll: () => Promise<IPCResponse<Conversation[]>>;
  get: (id: string) => Promise<IPCResponse<{ conversation: Conversation; messages: Message[] }>>;
  create: (id: string, title: string | null, models: string[]) => Promise<IPCResponse<{ id: string }>>;
  updateTitle: (id: string, title: string) => Promise<IPCResponse<void>>;
  delete: (id: string) => Promise<IPCResponse<void>>;
}

/**
 * Messages API
 */
export interface MessagesAPI {
  add: (messageData: MessageData) => Promise<IPCResponse<void>>;
}

/**
 * API Log
 */
export interface ApiLog {
  id: string;
  conversation_id: string | null;
  model_id: string;
  provider: string | null;
  request_tokens: number | null;
  response_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number;
  cost: number | null;
  status: string;
  error_message: string | null;
  created_at: number;
}

/**
 * API Log data for adding
 */
export interface ApiLogData {
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

/**
 * API Stats
 */
export interface ApiStats {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  total_tokens: number | null;
  total_cost: number | null;
  avg_latency: number | null;
}

/**
 * Model Stats
 */
export interface ModelStats {
  model_id: string;
  call_count: number;
  total_tokens: number | null;
  total_cost: number | null;
  avg_latency: number | null;
}

/**
 * API Logs API
 */
export interface ApiLogsAPI {
  add: (logData: ApiLogData) => Promise<IPCResponse<void>>;
  getAll: (limit?: number, offset?: number) => Promise<IPCResponse<{ logs: ApiLog[]; total: number }>>;
  getStats: () => Promise<IPCResponse<ApiStats>>;
  getByModel: () => Promise<IPCResponse<ModelStats[]>>;
}

/**
 * Share record
 */
export interface Share {
  id: string;
  share_code: string;
  share_url: string;
  message_count: number;
  created_at: number;
}

/**
 * Share creation response
 */
export interface ShareResponse {
  shareCode: string;
  shareUrl: string;
  messageCount: number;
}

/**
 * Share API
 */
export interface ShareAPI {
  createShare: (conversationId: string) => Promise<IPCResponse<ShareResponse>>;
  getHistory: (conversationId: string) => Promise<IPCResponse<Share[]>>;
}

/**
 * Main window API interface
 */
export interface WindowAPI {
  settings: SettingsAPI;
  dialog: DialogAPI;
  shell: ShellAPI;
  database: DatabaseAPI;
  app: AppAPI;
  openrouter: OpenRouterAPI;
  presets: PresetsAPI;
  conversations: ConversationsAPI;
  messages: MessagesAPI;
  apiLogs: ApiLogsAPI;
  share: ShareAPI;
}

declare global {
  interface Window {
    api: WindowAPI;
  }
}
