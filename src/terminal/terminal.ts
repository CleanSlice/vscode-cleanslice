/**
 * ClaudeTerminal — manages Claude Code terminal instances per slice.
 *
 * Each slice gets its own named terminal. If a terminal already exists
 * for a slice, it is revealed instead of creating a duplicate.
 */

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
//  State
// ---------------------------------------------------------------------------

const terminals = new Map<string, vscode.Terminal>();

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/** Open (or reveal) a Claude Code terminal for the given slice. */
export function openClaudeCode(sliceName: string): void {
	const existing = terminals.get(sliceName);
	if (existing && !isClosed(existing)) {
		existing.show();
		return;
	}

	const terminal = vscode.window.createTerminal({
		name: `Claude: ${sliceName}`,
	});

	terminal.show();
	terminal.sendText(`claude`, true);

	terminals.set(sliceName, terminal);
}

/** Dispose all managed terminals. Called on extension deactivation. */
export function disposeAllTerminals(): void {
	for (const terminal of terminals.values()) {
		if (!isClosed(terminal)) {
			terminal.dispose();
		}
	}
	terminals.clear();
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function isClosed(terminal: vscode.Terminal): boolean {
	return terminal.exitStatus !== undefined;
}
