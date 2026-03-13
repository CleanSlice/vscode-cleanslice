/**
 * SliceGraphPanel — manages the main Vue Flow webview tab in the editor area.
 *
 * Singleton that creates a WebviewPanel, loads the built Vue app,
 * and dispatches messages between the webview and the extension host.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import * as vscode from 'vscode';
import type { WebviewMessage, ExtensionMessage, SliceInfo, EdgeInfo, AppInfo } from '../types.js';
import { getActiveClaudeSlices } from '../terminal/terminal.js';

/** Shape of the parsed model.json (subset we care about). */
interface ModelJson {
	slices: Record<string, { name: string; path: string; files: string[]; type?: 'setup' | 'feature'; parent?: string | null; subslices?: string[] }>;
	edges: Array<{ from: string; to: string; count: number }>;
}

export class SliceGraphPanel {
	private static instance: SliceGraphPanel | undefined;
	private panel: vscode.WebviewPanel | undefined;
	private disposables: vscode.Disposable[] = [];
	private onNodeSelected: ((slice: string) => void) | undefined;
	private onOpenClaude: ((slice: string) => void) | undefined;
	private onLaunchTeam: ((slices: string[]) => void) | undefined;

	private constructor(private readonly extensionUri: vscode.Uri) {}

	// ---------------------------------------------------------------------------
	//  Singleton
	// ---------------------------------------------------------------------------

	static getInstance(extensionUri: vscode.Uri): SliceGraphPanel {
		if (!SliceGraphPanel.instance) {
			SliceGraphPanel.instance = new SliceGraphPanel(extensionUri);
		}
		return SliceGraphPanel.instance;
	}

	// ---------------------------------------------------------------------------
	//  Public API
	// ---------------------------------------------------------------------------

	/** Register a callback for when the user clicks a slice node in the graph. */
	onSliceSelected(handler: (slice: string) => void): void {
		this.onNodeSelected = handler;
	}

	/** Register a callback for when the user clicks the Claude icon on a slice. */
	onClaudeRequested(handler: (slice: string) => void): void {
		this.onOpenClaude = handler;
	}

	/** Register a callback for when the user launches an agent team. */
	onTeamLaunched(handler: (slices: string[]) => void): void {
		this.onLaunchTeam = handler;
	}

	/** Create a new panel or reveal the existing one. */
	open(): void {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One);
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'cleanslice-studio.graph',
			'CleanSlice',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
			}
		);

		this.panel.webview.html = buildWebviewHtml(this.panel.webview, this.extensionUri);

		// Auto-reload webview when dist/webview is rebuilt (uses Node fs.watch
		// because vscode.workspace.createFileSystemWatcher only covers workspace files)
		const indexHtml = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.html').fsPath;
		let reloadTimer: ReturnType<typeof setTimeout> | undefined;
		const fsWatcher = fs.watch(path.dirname(indexHtml), { recursive: true }, () => {
			// Debounce — Vite writes multiple files per rebuild
			clearTimeout(reloadTimer);
			reloadTimer = setTimeout(() => {
				if (this.panel) {
					this.panel.webview.html = buildWebviewHtml(this.panel.webview, this.extensionUri);
				}
			}, 300);
		});
		this.disposables.push({ dispose: () => fsWatcher.close() });

		this.panel.webview.onDidReceiveMessage(
			(message: WebviewMessage) => this.handleMessage(message),
			undefined,
			this.disposables
		);

		this.panel.onDidDispose(
			() => {
				this.panel = undefined;
				this.disposables.forEach(d => d.dispose());
				this.disposables = [];
			},
			undefined,
			this.disposables
		);
	}

	/** Send a typed message to the webview. */
	send(message: ExtensionMessage): void {
		this.panel?.webview.postMessage(message);
	}

	/** Re-send the current project state to the webview. */
	refresh(): void {
		this.sendProjectState();
	}

	/** Tear down the panel and release all resources. */
	dispose(): void {
		this.panel?.dispose();
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];
		SliceGraphPanel.instance = undefined;
	}

	// ---------------------------------------------------------------------------
	//  Message handling
	// ---------------------------------------------------------------------------

	private handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case 'webviewReady':
				this.send({ type: 'ready' });
				this.sendProjectState();
				break;
			case 'nodeSelected':
				this.onNodeSelected?.(message.slice);
				break;
			case 'openClaude':
				this.onOpenClaude?.(message.slice);
				break;
			case 'openFile':
				this.openFile(message.path);
				break;
			case 'initProject':
				this.runSync();
				break;
			case 'refresh':
				this.runSync();
				break;
			case 'launchTeam':
				this.onLaunchTeam?.(message.slices);
				break;
		}
	}

	// ---------------------------------------------------------------------------
	//  Helpers
	// ---------------------------------------------------------------------------

	private async openFile(filePath: string): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Beside });
	}

	/** Send project state and, if initialized, the model data. */
	private sendProjectState(): void {
		const model = this.loadModel();
		if (!model) {
			this.send({ type: 'projectState', initialized: false });
			return;
		}

		this.send({ type: 'projectState', initialized: true });

		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
		const slices: SliceInfo[] = Object.values(model.slices).map((s) => {
			const slicePath = s.path + '/';
			return {
				name: s.name,
				path: s.path,
				fileCount: s.files.length,
				type: s.type ?? (s.path.includes('setup') ? 'setup' as const : 'feature' as const),
				parent: s.parent ?? null,
				subsliceCount: s.subslices?.length ?? 0,
				app: s.path.split('/')[0] ?? 'unknown',
				domainCount: s.files.filter((f) => f.startsWith(slicePath + 'domain/')).length,
				dataCount: s.files.filter((f) => f.startsWith(slicePath + 'data/')).length,
				viewCount: s.files.filter((f) => {
					const rel = f.slice(slicePath.length);
					return !rel.startsWith('domain/') && !rel.startsWith('data/') && rel.includes('/');
				}).length,
				hasReadme: fs.existsSync(path.join(root, s.path, 'README.md')),
				hasRepositoryFile: s.files.some((f) => {
					const name = f.split('/').pop() ?? '';
					return name === 'repository.ts' || name.endsWith('.repository.ts');
				}),
			};
		});

		const edges: EdgeInfo[] = model.edges.map((e) => ({
			from: e.from,
			to: e.to,
			count: e.count,
		}));

		// Derive app-level metadata from slices
		const appMap = new Map<string, number>();
		for (const s of slices) {
			appMap.set(s.app, (appMap.get(s.app) ?? 0) + 1);
		}

		const API_STACK = ['NestJS', 'Prisma'];
		const FRONTEND_STACK = ['Nuxt', 'Vue', 'Pinia', 'Tailwind'];

		const apps: AppInfo[] = [...appMap.entries()].map(([name, sliceCount]) => ({
			name,
			sliceCount,
			techStack: name === 'api' ? API_STACK : FRONTEND_STACK,
			...(name === 'api' ? { swaggerUrl: '/api/docs' } : {}),
		}));

		this.send({ type: 'modelData', apps, slices, edges });

		// Restore claude active state for any open terminals
		for (const sliceName of getActiveClaudeSlices()) {
			this.send({ type: 'claudeState', slice: sliceName, active: true });
		}
	}

	/** Read and parse .cleanslice/model.json, or return null. */
	private loadModel(): ModelJson | null {
		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!root) return null;

		const modelPath = path.join(root, '.cleanslice', 'model.json');
		try {
			const raw = fs.readFileSync(modelPath, 'utf-8');
			return JSON.parse(raw) as ModelJson;
		} catch {
			return null;
		}
	}

	/** Run cleanslice-sync to initialize the .cleanslice/ folder. */
	private runSync(): void {
		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!root) {
			this.send({ type: 'initResult', success: false, error: 'No workspace folder open' });
			return;
		}

		const syncCli = path.join(this.extensionUri.fsPath, '..', 'tools', 'cleanslice-sync', 'dist', 'cli.js');

		execFile('node', [syncCli, 'sync', '--root', root], (err, _stdout, stderr) => {
			if (err) {
				this.send({ type: 'initResult', success: false, error: stderr || err.message });
				return;
			}
			this.send({ type: 'initResult', success: true });
			this.sendProjectState();
		});
	}
}

// ---------------------------------------------------------------------------
//  Webview HTML builder
// ---------------------------------------------------------------------------

/**
 * Read the Vite-built index.html and rewrite relative paths
 * to VS Code webview URIs so assets load correctly.
 */
function buildWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
	const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

	let html = fs.readFileSync(indexPath, 'utf-8');

	html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match: string, attr: string, filePath: string) => {
		const fileUri = vscode.Uri.joinPath(distPath, filePath);
		const webviewUri = webview.asWebviewUri(fileUri);
		return `${attr}="${webviewUri}"`;
	});

	return html;
}
