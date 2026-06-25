import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../stores/connectionStore';
import { QueryResult } from '../../types/query';
import { Server, RefreshCw, Activity, XCircle, Loader2 } from 'lucide-react';
import styles from '../../styles/components/ServerInfoPanel.module.css';

interface ServerInfo {
  version: string;
  database: string;
  user: string;
  server_addr: string | null;
  server_port: number | null;
  server_version: string;
  db_size: number;
  db_size_pretty: string;
}

const stateBadgeClass = (state: string): string => {
  if (state === 'active') return `${styles.stateBadge} ${styles.stateActive}`;
  if (state.startsWith('idle in transaction')) return `${styles.stateBadge} ${styles.stateIdleInTransaction}`;
  if (state === 'idle') return `${styles.stateBadge} ${styles.stateIdle}`;
  return `${styles.stateBadge} ${styles.stateOther}`;
};

export const ServerInfoPanel: React.FC = () => {
  const activeId = useConnectionStore((s) => s.activeId);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [queries, setQueries] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelingPid, setCancelingPid] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    setError(null);
    try {
      const [serverInfo, activeQueries] = await Promise.all([
        invoke<ServerInfo>('get_server_info', { connId: activeId }),
        invoke<QueryResult>('get_active_queries', { connId: activeId }),
      ]);
      setInfo(serverInfo);
      setQueries(activeQueries);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (pid: number) => {
    if (!activeId) return;
    setCancelingPid(pid);
    try {
      await invoke('cancel_backend', { connId: activeId, pid });
      await fetchData();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setCancelingPid(null);
    }
  };

  const pidIdx = queries?.columns.findIndex((c) => c.name === 'pid') ?? -1;
  const usenameIdx = queries?.columns.findIndex((c) => c.name === 'usename') ?? -1;
  const datnameIdx = queries?.columns.findIndex((c) => c.name === 'datname') ?? -1;
  const stateIdx = queries?.columns.findIndex((c) => c.name === 'state') ?? -1;
  const queryIdx = queries?.columns.findIndex((c) => c.name === 'query') ?? -1;
  const queryStartIdx = queries?.columns.findIndex((c) => c.name === 'query_start') ?? -1;
  const waitEventTypeIdx = queries?.columns.findIndex((c) => c.name === 'wait_event_type') ?? -1;
  const waitEventIdx = queries?.columns.findIndex((c) => c.name === 'wait_event') ?? -1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>
          <Server size={16} className={styles.headerIcon} />
          Server Info
        </h3>
        <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
          <RefreshCw size={12} className={loading ? styles.spin : ''} />
          Refresh
        </button>
      </div>

      <div className={styles.content}>
        {error && <div className={styles.errorContainer}>{error}</div>}

        {loading && !info ? (
          <div className={styles.loadingContainer}>
            <Loader2 size={18} className={styles.spin} />
            Loading server info...
          </div>
        ) : (
          <>
            {info && (
              <div className={styles.infoGrid}>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Version</div>
                  <div className={styles.infoValue}>{info.server_version}</div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Database</div>
                  <div className={styles.infoValue}>{info.database}</div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>User</div>
                  <div className={styles.infoValue}>{info.user}</div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Server Address</div>
                  <div className={styles.infoValue}>{info.server_addr ?? 'local'}</div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Server Port</div>
                  <div className={styles.infoValue}>{info.server_port ?? 'N/A'}</div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Database Size</div>
                  <div className={styles.infoValue}>{info.db_size_pretty}</div>
                </div>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Activity size={14} />
                Active Queries
                {queries && <span className={styles.tdMuted}>({queries.rows.length})</span>}
              </div>

              {queries && queries.rows.length > 0 ? (
                <table className={styles.queriesTable}>
                  <thead>
                    <tr className={styles.tableHeader}>
                      <th className={styles.th}>PID</th>
                      <th className={styles.th}>User</th>
                      <th className={styles.th}>Database</th>
                      <th className={styles.th}>State</th>
                      <th className={styles.th}>Query</th>
                      <th className={styles.th}>Started</th>
                      <th className={styles.th}>Wait</th>
                      <th className={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queries.rows.map((row, i) => {
                      const pid = pidIdx >= 0 ? row[pidIdx] : null;
                      const state = stateIdx >= 0 ? row[stateIdx] : '';
                      const waitType = waitEventTypeIdx >= 0 ? row[waitEventTypeIdx] : null;
                      const waitEvent = waitEventIdx >= 0 ? row[waitEventIdx] : null;
                      return (
                        <tr key={i} className={styles.tr}>
                          <td className={`${styles.td} ${styles.tdMono}`}>{pidIdx >= 0 ? row[pidIdx] : ''}</td>
                          <td className={styles.td}>{usenameIdx >= 0 ? row[usenameIdx] : ''}</td>
                          <td className={styles.td}>{datnameIdx >= 0 ? row[datnameIdx] : ''}</td>
                          <td className={styles.td}>
                            <span className={stateBadgeClass(String(state || ''))}>{state || 'unknown'}</span>
                          </td>
                          <td className={`${styles.td} ${styles.tdQuery}`} title={queryIdx >= 0 ? String(row[queryIdx] || '') : ''}>
                            {queryIdx >= 0 ? row[queryIdx] : ''}
                          </td>
                          <td className={`${styles.td} ${styles.tdMuted} ${styles.tdMono}`}>
                            {queryStartIdx >= 0 ? row[queryStartIdx] : ''}
                          </td>
                          <td className={`${styles.td} ${styles.tdMuted}`}>
                            {waitType && waitType !== 'None' ? `${waitType}${waitEvent && waitEvent !== 'None' ? `/${waitEvent}` : ''}` : ''}
                          </td>
                          <td className={styles.td}>
                            {pid && (
                              <button
                                className={styles.cancelBtn}
                                onClick={() => handleCancel(Number(pid))}
                                disabled={cancelingPid === Number(pid)}
                                title="Cancel this query"
                              >
                                {cancelingPid === Number(pid) ? <Loader2 size={10} className={styles.spin} /> : <XCircle size={10} />}
                                {' '}Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={styles.emptyRow}>No active queries</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
