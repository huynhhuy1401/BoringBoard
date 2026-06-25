import React, { useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { SchemaTree } from '../schema/SchemaTree';
import { QueryHistoryPanel } from '../history/QueryHistoryPanel';
import { FolderTree, Clock, LogOut } from 'lucide-react';
import styles from '../../styles/components/Sidebar.module.css';

export const Sidebar: React.FC = () => {
  const { activeId, disconnect } = useConnectionStore();
  const [view, setView] = useState<'explorer' | 'history'>('explorer');

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTabs}>
        <button
          className={`${styles.sidebarTab} ${view === 'explorer' ? styles.sidebarTabActive : ''}`}
          onClick={() => setView('explorer')}
          title="Explorer"
        >
          <FolderTree size={13} />
          <span>Explorer</span>
        </button>
        <button
          className={`${styles.sidebarTab} ${view === 'history' ? styles.sidebarTabActive : ''}`}
          onClick={() => setView('history')}
          title="History"
        >
          <Clock size={13} />
          <span>History</span>
        </button>
        <div className={styles.tabSpacer} />
        {activeId && (
          <button className={styles.iconBtn} onClick={disconnect} title="Disconnect">
            <LogOut size={13} />
          </button>
        )}
      </div>

      <div className={styles.content} key={view}>
        {view === 'explorer' ? (
          activeId ? <SchemaTree /> : <div className={styles.notConnected}><span>Not connected</span></div>
        ) : (
          <QueryHistoryPanel />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
