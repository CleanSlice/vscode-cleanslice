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

/** Toggle a Claude Code terminal for the given slice. Returns true if opened, false if closed. */
export function toggleClaudeCode(sliceName: string, sliceAbsPath?: string): boolean {
	const existing = terminals.get(sliceName);
	if (existing && !isClosed(existing)) {
		existing.dispose();
		terminals.delete(sliceName);
		return false;
	}

	const terminal = vscode.window.createTerminal({
		name: `Claude: ${sliceName}`,
		cwd: sliceAbsPath,
	});

	terminal.show();

	const prompt = [
		`You are working exclusively inside the slice "${sliceName}".`,
		sliceAbsPath ? `Slice directory: ${sliceAbsPath}` : '',
		'Focus all edits, reads, and searches within this slice folder.',
		'Do not modify files outside this slice unless explicitly asked.',
		'Follow CleanSlice architecture conventions (Presentation → Domain → Data layers).',
	].filter(Boolean).join(' ');

	const allowedTools = 'Read Edit Write Glob Grep';
	terminal.sendText(`claude --append-system-prompt ${shellEscape(prompt)} --allowedTools ${allowedTools}`, true);

	terminals.set(sliceName, terminal);
	return true;
}

/** Check if a Claude terminal is currently open for a slice. */
export function isClaudeOpen(sliceName: string): boolean {
	const existing = terminals.get(sliceName);
	return !!existing && !isClosed(existing);
}

/** Get all slice names that currently have an active Claude terminal. */
export function getActiveClaudeSlices(): string[] {
	const active: string[] = [];
	for (const [name, terminal] of terminals) {
		if (!isClosed(terminal)) {
			active.push(name);
		} else {
			terminals.delete(name);
		}
	}
	return active;
}

/** Launch an agent team with one agent per slice. Opens a single terminal. */
export function launchAgentTeam(slices: Array<{ name: string; absPath: string }>): void {
	const agents = slices.map((s) => ({
		name: s.name,
		prompt: [
			`You are working exclusively inside the slice "${s.name}".`,
			`Slice directory: ${s.absPath}`,
			'Focus all edits, reads, and searches within this slice folder.',
			'Do not modify files outside this slice unless explicitly asked.',
			'Follow CleanSlice architecture conventions (Presentation → Domain → Data layers).',
		].join(' '),
		allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
	}));

	const teamName = slices.map((s) => s.name.split('/').pop()).join('+');
	const terminal = vscode.window.createTerminal({
		name: `Claude Team: ${teamName}`,
	});

	terminal.show();
	terminal.sendText(`claude --agents ${shellEscape(JSON.stringify(agents))}`, true);
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

/** Escape a string for safe use as a single shell argument. */
function shellEscape(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`;
}
