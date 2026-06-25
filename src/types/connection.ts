export type SslMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';
export type SshAuthMethod = 'password' | 'private-key' | 'agent';

export interface SshConfig {
  host: string;
  port: number;
  username: string;
  auth_method: SshAuthMethod;
  password?: string;
  private_key_path?: string;
  passphrase?: string;
}

export interface ConnectionConfig {
  id: string;
  name: string;
  color_tag?: string;
  group?: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  save_password?: boolean;
  ssl_mode: SslMode;
  client_cert_path?: string;
  client_key_path?: string;
  ca_cert_path?: string;
  ssh_enabled: boolean;
  ssh_config?: SshConfig;
}
