export type DocumentDescriptor = {
  id: string;
  name: string;
  provider: 'google' | 'nextcloud';
  starred?: boolean;
  modifiedTime?: string;
  size?: number;
  path?: string;
};
