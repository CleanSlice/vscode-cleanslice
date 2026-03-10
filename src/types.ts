/** Slice info sent to the webview for graph rendering. */
export interface SliceInfo {
  name: string;
  path: string;
  fileCount: number;
  type: 'setup' | 'feature';
  parent: string | null;
  subsliceCount: number;
}

/** Edge info sent to the webview for graph rendering. */
export interface EdgeInfo {
  from: string;
  to: string;
  count: number;
}

/** Messages sent from the extension host to the webview */
export type ExtensionMessage =
  | { type: 'ready' }
  | { type: 'projectState'; initialized: boolean }
  | { type: 'initResult'; success: boolean; error?: string }
  | { type: 'modelData'; slices: SliceInfo[]; edges: EdgeInfo[] };

/** Messages sent from the webview to the extension host */
export type WebviewMessage =
  | { type: 'webviewReady' }
  | { type: 'nodeSelected'; slice: string }
  | { type: 'openFile'; path: string }
  | { type: 'initProject' }
  | { type: 'refresh' };
