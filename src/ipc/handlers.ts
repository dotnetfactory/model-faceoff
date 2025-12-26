/**
 * Model Faceoff - IPC Handlers
 *
 * Registers all IPC handlers for the main process.
 * Add your own handlers following the pattern below.
 */

import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getDatabase, closeDatabase, getCurrentDatabasePath } from '../database/connection';
import { getDatabaseInfo, migrateDatabase, getDefaultDatabasePath, saveDatabaseConfig } from '../database/config';
import { fetchModels, streamCompletion, isFreeModel, ChatMessage, OpenRouterModel } from '../services/openrouter';

// Store for active stream abort controllers
const activeStreams = new Map<string, AbortController>();

// Cache for models (separate caches for free mode vs authenticated mode)
let modelsCache: OpenRouterModel[] | null = null;
let modelsCacheTime = 0;
let modelsCacheIsFreeMode = false;
const MODELS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Register all IPC handlers
 */
export function registerIPCHandlers(): void {
  // ============= Settings =============

  ipcMain.handle('settings:get', async (_, key: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return { success: true, data: row?.value || null };
    } catch (error) {
      return { success: false, error: { code: 'GET_SETTING_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('settings:set', async (_, key: string, value: string) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare(`
        INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, value, now, now);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'SET_SETTING_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: { code: 'GET_ALL_SETTINGS_ERROR', message: String(error) } };
    }
  });

  // ============= Dialog =============

  ipcMain.handle(
    'dialog:showSaveDialog',
    async (_, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const result = await dialog.showSaveDialog({
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
      return result.canceled ? undefined : result.filePath;
    }
  );

  ipcMain.handle(
    'dialog:showOpenDialog',
    async (_, options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => {
      const result = await dialog.showOpenDialog({
        filters: options?.filters,
        properties: options?.properties as ('openFile' | 'openDirectory' | 'multiSelections')[],
      });
      return result.canceled ? undefined : result.filePaths;
    }
  );

  // ============= Shell =============

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // ============= Database Location =============

  ipcMain.handle('database:getInfo', async () => {
    try {
      const info = getDatabaseInfo();
      const currentPath = getCurrentDatabasePath();
      return {
        success: true,
        data: {
          ...info,
          currentPath: currentPath || info.currentPath,
        },
      };
    } catch (error) {
      return { success: false, error: { code: 'GET_DB_INFO_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('database:migrateToDocuments', async () => {
    try {
      const info = getDatabaseInfo();
      const sourcePath = getCurrentDatabasePath() || info.currentPath;
      const destPath = getDefaultDatabasePath();

      if (sourcePath === destPath) {
        return {
          success: false,
          error: { code: 'ALREADY_IN_DOCUMENTS', message: 'Database is already in Documents folder' },
        };
      }

      // Close the current database connection
      closeDatabase();

      // Perform the migration
      const result = migrateDatabase(sourcePath, destPath);

      if (!result.success) {
        getDatabase(); // Re-open at old location
        return { success: false, error: { code: 'MIGRATION_FAILED', message: result.error } };
      }

      // Re-open the database at the new location
      getDatabase();

      return {
        success: true,
        data: { oldPath: sourcePath, newPath: destPath },
      };
    } catch (error) {
      try {
        getDatabase();
      } catch {
        // Ignore recovery errors
      }
      return { success: false, error: { code: 'MIGRATION_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('database:showInFinder', async () => {
    const currentPath = getCurrentDatabasePath();
    if (currentPath) {
      shell.showItemInFolder(currentPath);
      return { success: true };
    }
    return { success: false, error: { code: 'NO_DB_PATH', message: 'Database path not available' } };
  });

  ipcMain.handle('database:selectExisting', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Database',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile'],
        message: 'Select an existing database file',
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, error: { code: 'CANCELLED', message: 'Selection cancelled' } };
      }

      const selectedPath = result.filePaths[0];

      // Close the current database connection
      closeDatabase();

      // Save the new path to config
      saveDatabaseConfig({ dbPath: selectedPath });

      // Re-open the database at the new location
      getDatabase();

      return { success: true, data: { newPath: selectedPath } };
    } catch (error) {
      try {
        getDatabase();
      } catch {
        // Ignore recovery errors
      }
      return { success: false, error: { code: 'SELECT_ERROR', message: String(error) } };
    }
  });

  // ============= App =============

  ipcMain.handle('app:getVersion', () => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle('app:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
    return { success: true };
  });

  // ============= OpenRouter API =============

  ipcMain.handle('openrouter:getModels', async () => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('openrouter_api_key') as
        | { value: string }
        | undefined;
      const apiKey = row?.value || undefined;
      const isFreeMode = !apiKey;

      // Check cache (invalidate if mode changed)
      if (
        modelsCache &&
        Date.now() - modelsCacheTime < MODELS_CACHE_DURATION &&
        modelsCacheIsFreeMode === isFreeMode
      ) {
        return { success: true, data: modelsCache, isFreeMode };
      }

      const models = await fetchModels(apiKey);
      modelsCache = models;
      modelsCacheTime = Date.now();
      modelsCacheIsFreeMode = isFreeMode;

      return { success: true, data: models, isFreeMode };
    } catch (error) {
      return { success: false, error: { code: 'FETCH_MODELS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('openrouter:clearModelsCache', async () => {
    modelsCache = null;
    modelsCacheTime = 0;
    return { success: true };
  });

  ipcMain.handle('openrouter:getApiKeyStatus', async () => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('openrouter_api_key') as
        | { value: string }
        | undefined;
      const hasApiKey = !!row?.value;
      return {
        success: true,
        data: {
          hasApiKey,
          isFreeMode: !hasApiKey,
        },
      };
    } catch (error) {
      return { success: false, error: { code: 'GET_STATUS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle(
    'openrouter:startStream',
    async (event, streamId: string, model: string, messages: ChatMessage[]) => {
      try {
        const db = getDatabase();
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('openrouter_api_key') as
          | { value: string }
          | undefined;
        const apiKey = row?.value || undefined;
        const isFreeMode = !apiKey;

        // In free mode, only allow free models
        if (isFreeMode && !model.endsWith(':free')) {
          return {
            success: false,
            error: {
              code: 'FREE_MODE_RESTRICTION',
              message: 'This model requires an API key. Please add your OpenRouter API key in Settings to use paid models.',
            },
          };
        }

        const abortController = new AbortController();
        activeStreams.set(streamId, abortController);

        const startTime = Date.now();
        let fullContent = '';
        let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        // Get the sender window
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          return { success: false, error: { code: 'NO_WINDOW', message: 'Window not found' } };
        }

        // Start streaming in background
        (async () => {
          try {
            for await (const chunk of streamCompletion(apiKey, model, messages, abortController.signal)) {
              if (abortController.signal.aborted) break;

              const content = chunk.choices[0]?.delta?.content || '';
              fullContent += content;

              if (chunk.usage) {
                usage = chunk.usage;
              }

              // Send chunk to renderer
              window.webContents.send('openrouter:streamChunk', {
                streamId,
                content,
                done: false,
              });
            }

            const latency_ms = Date.now() - startTime;

            // Send completion
            window.webContents.send('openrouter:streamChunk', {
              streamId,
              content: '',
              done: true,
              usage,
              latency_ms,
              fullContent,
            });
          } catch (error) {
            if (!abortController.signal.aborted) {
              window.webContents.send('openrouter:streamChunk', {
                streamId,
                content: '',
                done: true,
                error: String(error),
              });
            }
          } finally {
            activeStreams.delete(streamId);
          }
        })();

        return { success: true, data: { streamId } };
      } catch (error) {
        return { success: false, error: { code: 'STREAM_ERROR', message: String(error) } };
      }
    }
  );

  ipcMain.handle('openrouter:stopStream', async (_, streamId: string) => {
    const controller = activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      activeStreams.delete(streamId);
    }
    return { success: true };
  });

  // Free model for generating conversation titles (works without API key)
  const TITLE_GENERATION_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';

  ipcMain.handle('openrouter:generateTitle', async (_, userMessage: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('openrouter_api_key') as
        | { value: string }
        | undefined;
      // API key is optional - title generation uses a free model
      const apiKey = row?.value || undefined;

      const { getCompletion } = await import('../services/openrouter');
      const result = await getCompletion(apiKey, TITLE_GENERATION_MODEL, [
        {
          role: 'system',
          content: 'Generate a very short title (3-6 words) for a conversation that starts with the following message. Reply with ONLY the title, no quotes, no punctuation at the end.',
        },
        {
          role: 'user',
          content: userMessage,
        },
      ]);

      if (result.error) {
        return { success: false, error: { code: 'GENERATION_ERROR', message: result.error } };
      }

      // Clean up the title - remove quotes, trim whitespace
      const title = result.content.replace(/^["']|["']$/g, '').trim();

      return { success: true, data: title };
    } catch (error) {
      return { success: false, error: { code: 'GENERATION_ERROR', message: String(error) } };
    }
  });

  // ============= Presets =============

  ipcMain.handle('presets:getAll', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM presets ORDER BY updated_at DESC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: { code: 'GET_PRESETS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('presets:save', async (_, id: string, name: string, models: string[]) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare(
        `
        INSERT INTO presets (id, name, models, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, models = excluded.models, updated_at = excluded.updated_at
      `
      ).run(id, name, JSON.stringify(models), now, now);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'SAVE_PRESET_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('presets:delete', async (_, id: string) => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM presets WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_PRESET_ERROR', message: String(error) } };
    }
  });

  // ============= Conversations =============

  ipcMain.handle('conversations:getAll', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: { code: 'GET_CONVERSATIONS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('conversations:get', async (_, id: string) => {
    try {
      const db = getDatabase();
      const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
      if (!conversation) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } };
      }
      const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(id);
      return { success: true, data: { conversation, messages } };
    } catch (error) {
      return { success: false, error: { code: 'GET_CONVERSATION_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('conversations:create', async (_, id: string, title: string | null, models: string[]) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare('INSERT INTO conversations (id, title, models, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        title,
        JSON.stringify(models),
        now,
        now
      );
      return { success: true, data: { id } };
    } catch (error) {
      return { success: false, error: { code: 'CREATE_CONVERSATION_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('conversations:updateTitle', async (_, id: string, title: string) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'UPDATE_CONVERSATION_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('conversations:delete', async (_, id: string) => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
      db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_CONVERSATION_ERROR', message: String(error) } };
    }
  });

  // ============= Messages =============

  ipcMain.handle(
    'messages:add',
    async (
      _,
      messageData: {
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
    ) => {
      try {
        const db = getDatabase();
        const now = Date.now();
        db.prepare(
          `
        INSERT INTO messages (id, conversation_id, role, content, model_id, panel_index, tokens_prompt, tokens_completion, latency_ms, cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        ).run(
          messageData.id,
          messageData.conversation_id,
          messageData.role,
          messageData.content,
          messageData.model_id || null,
          messageData.panel_index ?? null,
          messageData.tokens_prompt ?? null,
          messageData.tokens_completion ?? null,
          messageData.latency_ms ?? null,
          messageData.cost ?? null,
          now
        );

        // Update conversation timestamp
        db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, messageData.conversation_id);

        return { success: true };
      } catch (error) {
        return { success: false, error: { code: 'ADD_MESSAGE_ERROR', message: String(error) } };
      }
    }
  );

  // ============= API Logs =============

  ipcMain.handle(
    'apiLogs:add',
    async (
      _,
      logData: {
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
    ) => {
      try {
        const db = getDatabase();
        const now = Date.now();
        db.prepare(
          `
        INSERT INTO api_logs (id, conversation_id, model_id, provider, request_tokens, response_tokens, total_tokens, latency_ms, cost, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        ).run(
          logData.id,
          logData.conversation_id || null,
          logData.model_id,
          logData.provider || null,
          logData.request_tokens ?? null,
          logData.response_tokens ?? null,
          logData.total_tokens ?? null,
          logData.latency_ms,
          logData.cost ?? null,
          logData.status,
          logData.error_message || null,
          now
        );
        return { success: true };
      } catch (error) {
        return { success: false, error: { code: 'ADD_LOG_ERROR', message: String(error) } };
      }
    }
  );

  ipcMain.handle('apiLogs:getAll', async (_, limit?: number, offset?: number) => {
    try {
      const db = getDatabase();
      const actualLimit = limit || 100;
      const actualOffset = offset || 0;
      const rows = db
        .prepare('SELECT * FROM api_logs ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(actualLimit, actualOffset);
      const countResult = db.prepare('SELECT COUNT(*) as total FROM api_logs').get() as { total: number };
      return { success: true, data: { logs: rows, total: countResult.total } };
    } catch (error) {
      return { success: false, error: { code: 'GET_LOGS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('apiLogs:getStats', async () => {
    try {
      const db = getDatabase();
      const stats = db
        .prepare(
          `
        SELECT
          COUNT(*) as total_calls,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_calls,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_calls,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(latency_ms) as avg_latency
        FROM api_logs
      `
        )
        .get();
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: { code: 'GET_STATS_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('apiLogs:getByModel', async () => {
    try {
      const db = getDatabase();
      const stats = db
        .prepare(
          `
        SELECT
          model_id,
          COUNT(*) as call_count,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(latency_ms) as avg_latency
        FROM api_logs
        GROUP BY model_id
        ORDER BY call_count DESC
      `
        )
        .all();
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: { code: 'GET_MODEL_STATS_ERROR', message: String(error) } };
    }
  });

  // ============= Shares =============

  // Use localhost in development, production URL in packaged app
  // app.isPackaged is true when running from a built .app/.exe, false during npm run dev
  const SHARE_API_URL = app.isPackaged
    ? 'https://www.modelfaceoff.com'
    : 'http://localhost:3000';

  ipcMain.handle('share:createShare', async (_, conversationId: string) => {
    try {
      const db = getDatabase();

      // Get conversation
      const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as
        | { id: string; title: string | null; models: string }
        | undefined;

      if (!conversation) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } };
      }

      // Get messages
      const messages = db
        .prepare(
          `
        SELECT id, role, content, model_id, panel_index, tokens_prompt, tokens_completion, latency_ms, cost, created_at
        FROM messages WHERE conversation_id = ?
        ORDER BY created_at
      `
        )
        .all(conversationId) as Array<{
        id: string;
        role: string;
        content: string;
        model_id: string | null;
        panel_index: number | null;
        tokens_prompt: number | null;
        tokens_completion: number | null;
        latency_ms: number | null;
        cost: number | null;
        created_at: number;
      }>;

      if (messages.length === 0) {
        return { success: false, error: { code: 'NO_MESSAGES', message: 'Conversation has no messages' } };
      }

      // Build share payload (NO API keys - just conversation data)
      const shareData = {
        title: conversation.title,
        models: JSON.parse(conversation.models),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model_id: m.model_id,
          panel_index: m.panel_index,
          tokens_prompt: m.tokens_prompt,
          tokens_completion: m.tokens_completion,
          latency_ms: m.latency_ms,
          cost: m.cost,
          created_at: m.created_at,
        })),
      };

      // Step 1: Get token
      const tokenResponse = await fetch(`${SHARE_API_URL}/api/share/token`);
      const tokenResult = (await tokenResponse.json()) as {
        success: boolean;
        token?: string;
        error?: { code: string; message: string };
      };

      if (!tokenResult.success || !tokenResult.token) {
        return {
          success: false,
          error: {
            code: tokenResult.error?.code || 'TOKEN_ERROR',
            message: tokenResult.error?.message || 'Failed to get share token',
          },
        };
      }

      // Step 2: Create share with token
      const shareResponse = await fetch(`${SHARE_API_URL}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.token}`,
        },
        body: JSON.stringify(shareData),
      });

      const shareResult = (await shareResponse.json()) as {
        success: boolean;
        shareCode?: string;
        shareUrl?: string;
        error?: { code: string; message: string };
      };

      if (!shareResult.success || !shareResult.shareCode) {
        return {
          success: false,
          error: {
            code: shareResult.error?.code || 'SHARE_ERROR',
            message: shareResult.error?.message || 'Failed to create share',
          },
        };
      }

      // Construct the share URL locally (uses localhost in dev, production URL in packaged app)
      const shareUrl = `${SHARE_API_URL}/s/${shareResult.shareCode}`;

      // Step 3: Save share to local database
      const shareId = crypto.randomUUID();
      const now = Date.now();
      db.prepare(
        `
        INSERT INTO shares (id, conversation_id, share_code, share_url, message_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(shareId, conversationId, shareResult.shareCode, shareUrl, messages.length, now);

      return {
        success: true,
        data: {
          shareCode: shareResult.shareCode,
          shareUrl,
          messageCount: messages.length,
        },
      };
    } catch (error) {
      console.error('Share creation error:', error);
      return { success: false, error: { code: 'SHARE_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('share:getHistory', async (_, conversationId: string) => {
    try {
      const db = getDatabase();
      const shares = db
        .prepare(
          `
        SELECT id, share_code, share_url, message_count, created_at
        FROM shares
        WHERE conversation_id = ?
        ORDER BY created_at DESC
      `
        )
        .all(conversationId);
      return { success: true, data: shares };
    } catch (error) {
      return { success: false, error: { code: 'GET_SHARES_ERROR', message: String(error) } };
    }
  });

  console.log('[IPC] All handlers registered');
}
