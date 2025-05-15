/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, ConfigurationTarget } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

function updateFileAssociations() {
	const configuration = workspace.getConfiguration();
	const fileAssociations: { [key: string]: string } = configuration.get('files.associations') || {};
	fileAssociations['input_report.txt'] = 'mindes';
	configuration.update('files.associations', fileAssociations, ConfigurationTarget.Global);
}

function assignKeyColor() {
	const config = workspace.getConfiguration('mindes');
	const enabled = config.get<boolean>('semanticHighlighting');
	const color = config.get<string[]>('semanticTokenColors');

	if (!enabled || !color) return;

	const colorRules = Object.fromEntries(
		Object.keys(color).map(subkey => [
			subkey,
			{ foreground: color[subkey] }
		])
	);

	workspace.getConfiguration().update(
		'editor.semanticTokenColorCustomizations',
		{ rules: colorRules },
		ConfigurationTarget.Global
	);
}

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'mindes' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	updateFileAssociations();
	assignKeyColor();

	// Create the language client and start the client.
	client = new LanguageClient(
		'MInDesServer',
		'MInDes Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
