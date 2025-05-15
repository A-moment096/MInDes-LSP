/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	Diagnostic,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
	SemanticTokensParams,
	SemanticTokens,
	SemanticTokensBuilder
} from 'vscode-languageserver/node';

// Create LSP connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Configuration capability flags
let hasConfigurationCapability = false;

// Default and document-specific settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

// Load completions from external JSON
let completionsList: Record<string, string[]> = {};
try {
	const completionsFile = readFileSync(resolve(__dirname, '../src/AutoCompletion.json'), 'utf-8');
	completionsList = JSON.parse(completionsFile);
	connection.console.log('Completions loaded from JSON file');
} catch (error: any) {
	connection.console.log(`Failed to read completions JSON file: ${error.message}`);
}

// Initialization handler
connection.onInitialize((params: InitializeParams): InitializeResult => {
	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && capabilities.workspace.configuration
	);

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.']
			},
			semanticTokensProvider: {
				legend: {
					tokenTypes: [
						'subkey1', 'subkey2', 'subkey3', 'subkey4',
						'subkey5', 'subkey6', 'subkey7', 'subkey8'
					],
					tokenModifiers: []
				},
				full: true
			}
		}
	};
});

connection.onInitialized(() => {
	connection.console.log('Server initialized');
});

connection.languages.semanticTokens.on((params: SemanticTokensParams): SemanticTokens => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return { data: [] };

	const builder = new SemanticTokensBuilder();
	const lines = document.getText().split(/\r?\n/g);

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];

		const keyMatch = line.match(/^([a-zA-Z0-9_.]+)\s*=/);
		if (!keyMatch) continue;

		const key = keyMatch[1];
		const subkeys = key.split('.');

		let charIndex = 0;
		for (let i = 0; i < subkeys.length && i < 8; i++) {
			const subkey = subkeys[i];
			const tokenType = `subkey${i + 1}`; // subkey1 to subkey8

			builder.push(lineIndex, charIndex, subkey.length, i, 0); // `i` is the tokenType index
			charIndex += subkey.length + 1; // +1 for the dot
		}
	}

	return builder.build();
});

// Handle configuration changes
connection.onDidChangeConfiguration(change => {
	globalSettings = <ExampleSettings>(change.settings.MInDesServer || defaultSettings);
	connection.languages.diagnostics.refresh();
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}

	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'MInDesServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Document lifecycle handlers
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// Simplified validator (disabled diagnostics)
async function validateTextDocument(_textDocument: TextDocument): Promise<Diagnostic[]> {
	return [];
}

// Completion support
function getCompletionItems(path: string): CompletionItem[] {
	const items = completionsList[path] || [];
	return items.map(item => ({
		label: item,
		kind: CompletionItemKind.Property
	}));
}

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
	const document = documents.get(params.textDocument.uri);
	const position = params.position;

	if (!document) return [];

	const text = document.getText({
		start: { line: position.line, character: 0 },
		end: position
	});

	const segments = text.split('.').map(segment => segment.trim());
	const path = segments.slice(0, -1).join('.');

	return getCompletionItems(path);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	return item;
});

// Start listening to LSP events
documents.listen(connection);
connection.listen();
