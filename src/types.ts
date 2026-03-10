/** Slice info sent to the webview for graph rendering. */
export interface SliceInfo {
  name: string;
  path: string;
  fileCount: number;
  type: 'setup' | 'feature';
  parent: string | null;
  subsliceCount: number;
  /** Top-level application directory the slice belongs to (e.g. "api", "app", "admin"). */
  app: string;
}

/** Edge info sent to the webview for graph rendering. */
export interface EdgeInfo {
  from: string;
  to: string;
  count: number;
}

/** App-level metadata sent to the webview for hub node rendering. */
export interface AppInfo {
  name: string;
  techStack: string[];
  swaggerUrl?: string;
  sliceCount: number;
}

/** Messages sent from the extension host to the webview */
export type ExtensionMessage =
  | { type: 'ready' }
  | { type: 'projectState'; initialized: boolean }
  | { type: 'initResult'; success: boolean; error?: string }
  | { type: 'modelData'; apps: AppInfo[]; slices: SliceInfo[]; edges: EdgeInfo[] };

/** Messages sent from the webview to the extension host */
export type WebviewMessage =
  | { type: 'webviewReady' }
  | { type: 'nodeSelected'; slice: string }
  | { type: 'openFile'; path: string }
  | { type: 'initProject' }
  | { type: 'refresh' };
