import React, { useState, useEffect } from 'react';
import { ConnectionConfig, SslMode, SshAuthMethod } from '../../types/connection';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { Check, X, Loader2 } from 'lucide-react';
import styles from '../../styles/components/ConnectionForm.module.css';

interface ConnectionFormProps {
  initialConfig?: ConnectionConfig | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  id: '',
  name: '',
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: '',
  save_password: true,
  ssl_mode: 'disable',
  ssh_enabled: false,
};

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  initialConfig,
  onSuccess,
  onCancel,
}) => {
  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'general' | 'ssl' | 'ssh'>('general');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { saveConnection, connect, activeId, disconnect } = useConnectionStore();
  const { clearSchemaCache, fetchSchemas } = useSchemaStore();

  useEffect(() => {
    const loadPassword = async () => {
      if (initialConfig) {
        let password = '';
        try {
          const savedPassword = await import('@tauri-apps/api/core').then((mod) =>
            mod.invoke<string | null>('get_connection_password', { id: initialConfig.id })
          );
          if (savedPassword) {
            password = savedPassword;
          }
        } catch (err) {
          console.error('Failed to load connection password:', err);
        }
        setConfig({
          ...initialConfig,
          password,
          save_password: initialConfig.save_password !== false,
        });
      } else {
        setConfig({
          ...DEFAULT_CONFIG,
          id: `conn_${Date.now()}`,
          save_password: true,
        });
      }
    };
    loadPassword();
    setTestResult(null);
  }, [initialConfig]);

  const handleChange = (field: keyof ConnectionConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSshChange = (field: string, value: any) => {
    setConfig((prev) => {
      const ssh_config = prev.ssh_config || {
        host: 'localhost',
        port: 22,
        username: '',
        auth_method: 'password',
      };
      return {
        ...prev,
        ssh_config: { ...ssh_config, [field]: value },
      };
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await import('@tauri-apps/api/core').then((mod) =>
        mod.invoke<boolean>('test_connection', { config })
      );
      setTestResult({
        success: res,
        message: res ? 'Connection test successful!' : 'Connection test failed.',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      alert('Profile name is required');
      return;
    }
    try {
      await saveConnection(config);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(`Failed to save: ${err.message || err}`);
    }
  };

  const handleConnect = async () => {
    try {
      // Save profile first
      await saveConnection(config);
      
      // If we are currently connected to another DB, disconnect first
      if (activeId) {
        await disconnect();
      }
      
      clearSchemaCache();
      await connect(config);
      
      // Fetch schema tree on connection
      await fetchSchemas(config.id);
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(`Connection failed: ${err.message || err}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {initialConfig ? `Edit: ${config.name}` : 'New Connection Profile'}
        </h3>
      </div>


      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'general' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'ssl' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ssl')}
        >
          SSL
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'ssh' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ssh')}
        >
          SSH Tunnel
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'general' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Profile Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Local PG Server"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Color Tag</label>
              <select
                value={config.color_tag || ''}
                onChange={(e) => handleChange('color_tag', e.target.value || undefined)}
              >
                <option value="">None</option>
                <option value="#3b82f6">Blue</option>
                <option value="#10b981">Green</option>
                <option value="#f59e0b">Orange</option>
                <option value="#ef4444">Red</option>
                <option value="#8b5cf6">Purple</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Group</label>
              <input
                type="text"
                value={config.group || ''}
                onChange={(e) => handleChange('group', e.target.value || undefined)}
                placeholder="e.g. Production, Development"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Host</label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => handleChange('host', e.target.value)}
                placeholder="localhost or socket path"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Port</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || 5432)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Database</label>
              <input
                type="text"
                value={config.database}
                onChange={(e) => handleChange('database', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Username</label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => handleChange('username', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                value={config.password || ''}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder={config.save_password === false ? "Session password" : "••••••••"}
              />
            </div>
            <div className={styles.formGroupRow} style={{ marginTop: '8px' }}>
              <input
                type="checkbox"
                id="save_password"
                checked={config.save_password !== false}
                onChange={(e) => handleChange('save_password', e.target.checked)}
              />
              <label htmlFor="save_password" style={{ userSelect: 'none' }}>Save Password in OS Keychain</label>
            </div>
          </div>
        )}

        {activeTab === 'ssl' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>SSL Mode</label>
              <select
                value={config.ssl_mode}
                onChange={(e) => handleChange('ssl_mode', e.target.value as SslMode)}
              >
                <option value="disable">Disable (Insecure)</option>
                <option value="require">Require</option>
                <option value="verify-ca">Verify CA</option>
                <option value="verify-full">Verify CA & Hostname</option>
              </select>
            </div>
            {(config.ssl_mode === 'verify-ca' || config.ssl_mode === 'verify-full') && (
              <div className={styles.formGroup}>
                <label>CA Certificate Path</label>
                <input
                  type="text"
                  value={config.ca_cert_path || ''}
                  onChange={(e) => handleChange('ca_cert_path', e.target.value)}
                  placeholder="/path/to/server-ca.pem"
                />
              </div>
            )}
            {config.ssl_mode !== 'disable' && (
              <>
                <div className={styles.formGroup}>
                  <label>Client Certificate Path</label>
                  <input
                    type="text"
                    value={config.client_cert_path || ''}
                    onChange={(e) => handleChange('client_cert_path', e.target.value)}
                    placeholder="/path/to/client-cert.pem"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Client Private Key Path</label>
                  <input
                    type="text"
                    value={config.client_key_path || ''}
                    onChange={(e) => handleChange('client_key_path', e.target.value)}
                    placeholder="/path/to/client-key.pem"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'ssh' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroupRow}>
              <input
                type="checkbox"
                id="ssh_enabled"
                checked={config.ssh_enabled}
                onChange={(e) => handleChange('ssh_enabled', e.target.checked)}
              />
              <label htmlFor="ssh_enabled">Enable SSH Tunneling</label>
            </div>

            {config.ssh_enabled && (
              <>
                <div className={styles.formGroup}>
                  <label>SSH Host</label>
                  <input
                    type="text"
                    value={config.ssh_config?.host || ''}
                    onChange={(e) => handleSshChange('host', e.target.value)}
                    placeholder="ssh.server.com"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>SSH Port</label>
                  <input
                    type="number"
                    value={config.ssh_config?.port || 22}
                    onChange={(e) => handleSshChange('port', parseInt(e.target.value) || 22)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>SSH Username</label>
                  <input
                    type="text"
                    value={config.ssh_config?.username || ''}
                    onChange={(e) => handleSshChange('username', e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Authentication Method</label>
                  <select
                    value={config.ssh_config?.auth_method || 'password'}
                    onChange={(e) => handleSshChange('auth_method', e.target.value as SshAuthMethod)}
                  >
                    <option value="password">Password</option>
                    <option value="private-key">Private Key</option>
                    <option value="agent">SSH Agent</option>
                  </select>
                </div>
                {config.ssh_config?.auth_method === 'password' && (
                  <div className={styles.formGroup}>
                    <label>SSH Password</label>
                    <input
                      type="password"
                      value={config.ssh_config?.password || ''}
                      onChange={(e) => handleSshChange('password', e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                )}
                {config.ssh_config?.auth_method === 'private-key' && (
                  <>
                    <div className={styles.formGroup}>
                      <label>Private Key Path</label>
                      <input
                        type="text"
                        value={config.ssh_config?.private_key_path || ''}
                        onChange={(e) => handleSshChange('private_key_path', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Key Passphrase (Optional)</label>
                      <input
                        type="password"
                        value={config.ssh_config?.passphrase || ''}
                        onChange={(e) => handleSshChange('passphrase', e.target.value)}
                        placeholder="Key Passphrase"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {testResult && (
        <div className={`${styles.testAlert} ${testResult.success ? styles.testSuccess : styles.testError}`}>
          {testResult.success ? <Check size={16} /> : <X size={16} />}
          <span>{testResult.message}</span>
        </div>
      )}

      <div className={styles.actions}>
        <div className={styles.leftActions}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 size={14} className={styles.spin} /> : null}
            Test Connection
          </button>
        </div>
        <div className={styles.rightActions}>
          {onCancel && (
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleSave}>
            Save
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleConnect}>
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionForm;
