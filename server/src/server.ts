/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	HoverParams,
} from 'vscode-languageserver/node';
import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { readFileSync } from "fs";
import { resolve } from "path";
const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.']
			},
			hoverProvider: true
		}
	};
	return result;
});

connection.onInitialized(() => {
	connection.console.log('Server initialized');
});

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// Perform validation if necessary
}

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {

	globalSettings = <ExampleSettings>(
		(change.settings.MInDesServer || defaultSettings)
	);
	// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
	// We could optimize things here and re-fetch the setting first can compare it
	// to the existing setting, but this is out of scope for this example.
	connection.languages.diagnostics.refresh();
});

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

let completionsList: Record<string, string[]> = {};
try {
	const completionsFile = readFileSync(resolve(__dirname, "../src/AutoCompletion.json"), "utf-8");
	completionsList = JSON.parse(completionsFile);
	connection.console.log("Completions loaded from JSON file");
} catch (error) {
	connection.console.log("Failed to read completions JSON file: ${error.message}");
}

function getCompletionItems(path: string): CompletionItem[] {
	const items = completionsList[path] || [];
	return items.map(item => ({
		label: item,
		kind: CompletionItemKind.Property
	}));
}

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		const document = documents.get(_textDocumentPosition.textDocument.uri);
		const position = _textDocumentPosition.position;
		if (!document) {
			return [];
		}
		const text = document.getText({
			start: { line: position.line, character: 0 },
			end: position
		});

		const segments = text.split('.').map(segment => segment.trim());
		const path = segments.slice(0, -1).join('.');

		return getCompletionItems(path);
	}
);

connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		// if (item.data === 1) {
		// 	item.detail = 'TypeScript details';
		// 	item.documentation = 'TypeScript documentation';
		// } else if (item.data === 2) {
		// 	item.detail = 'JavaScript details';
		// 	item.documentation = 'JavaScript documentation';
		// }
		return item;
	}
);

// connection.onHover((param:HoverParams):CompletionItem=>{return param})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
