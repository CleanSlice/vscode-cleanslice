/**
 * SliceTreeSidebar — sidebar tree view showing files for the selected slice.
 *
 * When the user clicks a node in the graph, extension.ts calls setSlice()
 * which populates the tree with that slice's file structure.
 */

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface SliceFileItem {
	label: string;
	filePath: string;
	isDirectory: boolean;
	children?: SliceFileItem[];
}

// ---------------------------------------------------------------------------
//  Tree item (internal — maps SliceFileItem → VS Code TreeItem)
// ---------------------------------------------------------------------------

class SliceTreeItem extends vscode.TreeItem {
	constructor(item: SliceFileItem) {
		super(
			item.label,
			item.isDirectory
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None
		);

		if (item.isDirectory) {
			this.iconPath = vscode.ThemeIcon.Folder;
		} else {
			this.iconPath = vscode.ThemeIcon.File;
			this.resourceUri = vscode.Uri.file(item.filePath);
			this.command = {
				command: 'vscode.open',
				title: 'Open File',
				arguments: [vscode.Uri.file(item.filePath)],
			};
		}
	}
}

// ---------------------------------------------------------------------------
//  Provider
// ---------------------------------------------------------------------------

export class SliceTreeSidebar implements vscode.TreeDataProvider<SliceFileItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<SliceFileItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private currentSlice: string | undefined;
	private files: SliceFileItem[] = [];

	// -- Required by TreeDataProvider -----------------------------------------

	getTreeItem(element: SliceFileItem): vscode.TreeItem {
		return new SliceTreeItem(element);
	}

	getChildren(element?: SliceFileItem): SliceFileItem[] {
		if (!element) {
			return this.files;
		}
		return element.children ?? [];
	}

	// -- Public API -----------------------------------------------------------

	/** Replace the tree contents with files for the given slice. */
	setSlice(sliceName: string, files: SliceFileItem[]): void {
		this.currentSlice = sliceName;
		this.files = files;
		this._onDidChangeTreeData.fire(undefined);
	}

	/** Get the name of the currently displayed slice. */
	getCurrentSlice(): string | undefined {
		return this.currentSlice;
	}

	/** Empty the tree. */
	clear(): void {
		this.currentSlice = undefined;
		this.files = [];
		this._onDidChangeTreeData.fire(undefined);
	}

	dispose(): void {
		this._onDidChangeTreeData.dispose();
	}
}
