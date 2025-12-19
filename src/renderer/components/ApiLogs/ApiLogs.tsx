/**
 * ApiLogs - View API call logs and statistics
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, BarChart3, Clock, Hash, Coins, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { ApiLog, ApiStats, ModelStats } from '../../../types/window';
import './ApiLogs.css';

interface ApiLogsProps {
  onBack: () => void;
}

type TabType = 'logs' | 'stats';

export function ApiLogs({ onBack }: ApiLogsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);

    const [logsResult, statsResult, modelStatsResult] = await Promise.all([
      window.api.apiLogs.getAll(pageSize, page * pageSize),
      window.api.apiLogs.getStats(),
      window.api.apiLogs.getByModel(),
    ]);

    if (logsResult.success && logsResult.data) {
      setLogs(logsResult.data.logs);
      setTotal(logsResult.data.total);
    }

    if (statsResult.success && statsResult.data) {
      setStats(statsResult.data);
    }

    if (modelStatsResult.success && modelStatsResult.data) {
      setModelStats(modelStatsResult.data);
    }

    setLoading(false);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCost = (cost: number | null): string => {
    if (cost === null) return '-';
    if (cost < 0.0001) return '<$0.0001';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
  };

  const formatLatency = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="api-logs">
      {/* Header */}
      <div className="logs-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1>API Logs</h1>
        <button onClick={loadData} className="refresh-button" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="logs-tabs">
        <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          Logs
        </button>
        <button className={`tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
          Statistics
        </button>
      </div>

      {/* Content */}
      <div className="logs-content">
        {activeTab === 'logs' ? (
          <>
            {/* Stats Summary */}
            {stats && (
              <div className="stats-summary">
                <div className="stat-card">
                  <BarChart3 size={20} />
                  <div className="stat-value">{stats.total_calls}</div>
                  <div className="stat-label">Total Calls</div>
                </div>
                <div className="stat-card success">
                  <CheckCircle size={20} />
                  <div className="stat-value">{stats.successful_calls}</div>
                  <div className="stat-label">Successful</div>
                </div>
                <div className="stat-card error">
                  <XCircle size={20} />
                  <div className="stat-value">{stats.failed_calls}</div>
                  <div className="stat-label">Failed</div>
                </div>
                <div className="stat-card">
                  <Hash size={20} />
                  <div className="stat-value">{stats.total_tokens?.toLocaleString() || 0}</div>
                  <div className="stat-label">Total Tokens</div>
                </div>
                <div className="stat-card">
                  <Coins size={20} />
                  <div className="stat-value">{formatCost(stats.total_cost)}</div>
                  <div className="stat-label">Total Cost</div>
                </div>
                <div className="stat-card">
                  <Clock size={20} />
                  <div className="stat-value">{stats.avg_latency ? formatLatency(stats.avg_latency) : '-'}</div>
                  <div className="stat-label">Avg Latency</div>
                </div>
              </div>
            )}

            {/* Logs Table */}
            <div className="logs-table-container">
              {loading ? (
                <div className="loading-state">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="empty-state">No API calls logged yet</div>
              ) : (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className={log.status === 'error' ? 'error-row' : ''}>
                        <td className="time-cell">{formatDate(log.created_at)}</td>
                        <td className="model-cell">
                          <span className="model-name">{log.model_id.split('/').pop()}</span>
                          <span className="provider-name">{log.model_id.split('/')[0]}</span>
                        </td>
                        <td className="status-cell">
                          {log.status === 'success' ? (
                            <span className="status-badge success">
                              <CheckCircle size={12} />
                              Success
                            </span>
                          ) : (
                            <span className="status-badge error" title={log.error_message || ''}>
                              <XCircle size={12} />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="latency-cell">{formatLatency(log.latency_ms)}</td>
                        <td className="tokens-cell">
                          {log.total_tokens ? log.total_tokens.toLocaleString() : '-'}
                        </td>
                        <td className="cost-cell">{formatCost(log.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  Previous
                </button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          /* Statistics Tab */
          <div className="stats-tab">
            <h2>Usage by Model</h2>
            {modelStats.length === 0 ? (
              <div className="empty-state">No usage data yet</div>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Calls</th>
                    <th>Total Tokens</th>
                    <th>Total Cost</th>
                    <th>Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {modelStats.map((stat) => (
                    <tr key={stat.model_id}>
                      <td className="model-cell">
                        <span className="model-name">{stat.model_id.split('/').pop()}</span>
                        <span className="provider-name">{stat.model_id.split('/')[0]}</span>
                      </td>
                      <td>{stat.call_count}</td>
                      <td>{stat.total_tokens?.toLocaleString() || '-'}</td>
                      <td>{formatCost(stat.total_cost)}</td>
                      <td>{stat.avg_latency ? formatLatency(stat.avg_latency) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
