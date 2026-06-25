import React from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useTabStore } from '../../stores/tabStore';
import { CheckCircle2, AlertCircle, Database } from 'lucide-react';
import styles from '../../styles/components/StatusBar.module.css';

export const StatusBar: React.FC = () => {
  const { activeId, activeDb, activeSchema, connections } = useConnectionStore();
  const { tabs, activeTabId } = useTabStore();

  const activeConnection = connections.find((c) => c.id === activeId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const queryInfo = activeTab?.queryResult
    ? `${activeTab.queryResult.affected_rows} rows · ${activeTab.queryResult.execution_time_ms}ms`
    : activeTab?.loading
    ? 'Executing...'
    : activeTab?.error
    ? 'Error'
    : null;

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        {activeId && activeConnection ? (
          <>
            <span className={styles.connected}>
              <CheckCircle2 size={11} className={styles.successIcon} />
            </span>
            <span className={styles.info}>
              {activeConnection.username}@{activeConnection.host}:{activeConnection.port}
            </span>
            <span className={styles.separator}>/</span>
            <span className={styles.info}>{activeDb}</span>
            <span className={styles.separator}>/</span>
            <span className={styles.info}>{activeSchema}</span>
          </>
        ) : (
          <span className={styles.disconnected}>
            <AlertCircle size={11} />
            Disconnected
          </span>
        )}
      </div>
      <div className={styles.right}>
        {queryInfo && (
          <span className={styles.queryInfo}>{queryInfo}</span>
        )}
        <span className={styles.dbType}>
          <Database size={11} />
          PostgreSQL
        </span>
      </div>
    </div>
  );
};
export default StatusBar;
