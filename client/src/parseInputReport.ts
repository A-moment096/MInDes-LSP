import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

// Exported regex patterns for reuse
export const matchDebugStart = /^=+\s*([A-Z ]+)\s*=+$/;
export const matchDebugEnd = /^=+$/;
export const matchDebugRAW = /^\d+.*\|.*\|(.*)$/;
export const matchDebugSeparator = /^-+$/;
export const matchDebugTableHead = /^[A-Z0-9. ]+\s*\|.*$/;
export const matchDebugToken = /^\d+.*\|.*\|{"(.*)"}, {"(.*)"}, {"(.*)"}$/;
export const matchPrompts = /^>\s*\[.*\]\s(.*)|^\s*(#.*)$/;

type Section = 'none' | 'macros' | 'debug' | 'inputs' | 'tokens' | 'variables' | 'functions';

export async function parseInputReport(filePath: string): Promise<Map<string, string[]>> {
	const content = await fs.readFile(filePath, { encoding: 'utf-8' });
	const lines: string[] = content.split(/\r?\n/);

	const parsedContent: Map<string, string[]> = new Map([
		['macros', []],
		['inputs', []],
		['tokens', []],
		['functions', []],
		['variables', []],
		['prompts', []]
	]);

	let section: Section = 'none';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Always collect prompts
		if (matchPrompts.test(line)) {
			parsedContent.get('prompts')!.push(line);
		}

		// Section headers
		const debugStart = line.match(matchDebugStart);
		if (debugStart) {
			const header = debugStart[1].trim();
			if (header === 'M A C R O') {
				section = 'macros';
				continue;
			}
			if (header === 'D E B U G') {
				section = 'debug';
				continue;
			}
			section = 'none';
			continue;
		}

		// Section ends
		if (matchDebugEnd.test(line)) {
			section = 'none';
			continue;
		}

		// MACRO section
		if (section === 'macros') {
			if (matchDebugEnd.test(line)) {
				section = 'none';
				continue;
			}
			parsedContent.get('macros')!.push(line);
			continue;
		}

		// DEBUG section: look for table headers
		if (section === 'debug') {
			if (/^LINE\s+PROPERTY\s+\|CONTENT/.test(line)) {
				section = 'inputs';
				i++; // skip dashed line
				continue;
			}
			if (/^NO\.\s+VARIABLE\s+\|VALUE/.test(line)) {
				section = 'variables';
				i++;
				continue;
			}
			if (/^NO\.\s+FUNCTIONS\s+\|CONTENT/.test(line)) {
				section = 'functions';
				i++;
				continue;
			}
			if (/^NO\.\s+.*\|.*$/.test(line)) {
				section = 'tokens';
				i++;
				continue;
			}
			continue;
		}

		// Table sections
		if (section === 'inputs' || section === 'tokens' || section === 'variables' || section === 'functions') {
			if (matchDebugSeparator.test(line)) {
				section = 'debug';
				continue;
			}
			parsedContent.get(section)!.push(line);
			continue;
		}
	}

	return parsedContent;
}

export async function extractRawInputFile(filePath: string): Promise<string[]> {
	const parsed = await parseInputReport(filePath);
	// Filter out empty lines and lines that are just table separators
	return (parsed.get('inputs') || [])
		.map(l => l.match(matchDebugRAW)[1])
		.filter(l => l.length > 0 && !matchDebugSeparator.test(l));
}

export async function extractFullInputFile(filePath: string): Promise<string[]> {
	const parsed = await parseInputReport(filePath);
	// Filter out empty lines and lines that are just table separators
	return (parsed.get('prompts') || [])
		.map(l => {
			const match = l.match(matchPrompts);
			return match?.[1] ?? match?.[2];
		})
		.filter(l => l.length > 0 && !matchDebugSeparator.test(l));
}

export async function runExtractInputCommand(extractMethod: (filePath: string) => Promise<string[]>) {
	const inputUris = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Select input_report.txt',
		filters: { 'Text files': ['txt'], 'All files': ['*'] }
	});
	if (!inputUris || inputUris.length === 0) {
		vscode.window.showWarningMessage('No input file selected.');
		return;
	}
	const inputPath = inputUris[0].fsPath;

	const contents = await extractMethod(inputPath);

	const parentDir = path.dirname(inputPath);
	const parentName = path.basename(parentDir);
	const defaultOutput = path.join(path.dirname(parentDir), parentName + '.mindes');

	const outputUri = await vscode.window.showSaveDialog({
		defaultUri: vscode.Uri.file(defaultOutput),
		filters: { 'MInDes files': ['mindes'], 'All files': ['*'] },
		saveLabel: 'Save output file as...'
	});
	const outputPath = outputUri ? outputUri.fsPath : defaultOutput;

	await fs.writeFile(outputPath, contents.join('\n'), { encoding: 'utf-8' });
	vscode.window.showInformationMessage(`Extracted contents written to: ${outputPath}`);
}