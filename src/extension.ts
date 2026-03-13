import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SliceGraphPanel } from './panel/sliceGraphPanel.js';
import { SliceTreeSidebar, type SliceFileItem } from './sidebar/sliceTreeSidebar.js';
import { toggleClaudeCode, launchAgentTeam, disposeAllTerminals } from './terminal/terminal.js';

let graphPanel: SliceGraphPanel | undefined;
let treeProvider: SliceTreeSidebar | undefined;

export function activate(context: vscode.ExtensionContext) {
	treeProvider = new SliceTreeSidebar();
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('cleanslice-studio.sliceFiles', treeProvider)
	);

	graphPanel = SliceGraphPanel.getInstance(context.extensionUri);

	graphPanel.onSliceSelected((sliceName) => {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) return;

		// Look up the slice path from model.json
		const slicePath = resolveSlicePath(workspaceRoot, sliceName);
		if (slicePath) {
			const absPath = path.join(workspaceRoot, slicePath);
			const files = buildFileTree(absPath);
			treeProvider?.setSlice(sliceName, files);
		}
	});

	graphPanel.onClaudeRequested((sliceName) => {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		let sliceAbsPath: string | undefined;
		if (workspaceRoot) {
			const slicePath = resolveSlicePath(workspaceRoot, sliceName);
			if (slicePath) {
				sliceAbsPath = path.join(workspaceRoot, slicePath);
			}
		}
		const active = toggleClaudeCode(sliceName, sliceAbsPath);
		graphPanel?.send({ type: 'claudeState', slice: sliceName, active });
		// Re-send project state when Claude is closed so the graph picks up file changes
		if (!active) {
			graphPanel?.refresh();
		}
	});

	graphPanel.onTeamLaunched((slicePaths) => {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) return;

		const resolved = slicePaths
			.map((slicePath) => {
				// slicePath is the slice's relative path (e.g. "api/user/auth")
				// We need to find the slice name from model.json
				const absPath = path.join(workspaceRoot, slicePath);
				return { name: slicePath, absPath };
			})
			.filter((s) => s.absPath);

		if (resolved.length > 0) {
			launchAgentTeam(resolved);
		}
	});

	context.subscriptions.push(
		vscode.commands.registerCommand('cleanslice-studio.openGraph', () => {
			graphPanel?.open();
		})
	);

	// Auto-open the graph on activation
	graphPanel.open();
}

export function deactivate() {
	graphPanel?.dispose();
	treeProvider?.dispose();
	disposeAllTerminals();
}

/** Look up the slice's directory path from model.json. */
function resolveSlicePath(root: string, sliceName: string): string | null {
	try {
		const raw = fs.readFileSync(path.join(root, '.cleanslice', 'model.json'), 'utf-8');
		const model = JSON.parse(raw) as { slices: Record<string, { path: string }> };
		return model.slices[sliceName]?.path ?? null;
	} catch {
		return null;
	}
}

/** Recursively build a file tree from an actual directory on disk. */
function buildFileTree(dir: string): SliceFileItem[] {
	const items: SliceFileItem[] = [];

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return items;
	}

	// Sort: directories first, then files alphabetically
	const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
	const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));

	for (const d of dirs) {
		const abs = path.join(dir, d.name);
		items.push({
			label: d.name,
			filePath: abs,
			isDirectory: true,
			children: buildFileTree(abs),
		});
	}

	for (const f of files) {
		items.push({
			label: f.name,
			filePath: path.join(dir, f.name),
			isDirectory: false,
		});
	}

	return items;
}
