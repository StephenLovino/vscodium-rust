/**
 * VSCodium Rust Extension Host
 * This process executes third-party extensions in an isolated environment.
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

// Deep Proxy to prevent crashes on unimplemented vscode APIs
function createStubProxy(target, path = 'vscode') {
    return new Proxy(target, {
        get(obj, prop) {
            if (prop in obj) {
                return obj[prop];
            }
            if (typeof prop === 'string' && prop !== 'then') {
                // Return a callable object that also acts as a proxy
                const stub = function () {
                    // console.warn(`[Stub Callback] ${path}.${prop}() was called with`, arguments);
                    return createStubProxy({}, `${path}.${prop}()`);
                };
                return createStubProxy(stub, `${path}.${prop}`);
            }
            return undefined;
        }
    });
}

// The global vscode API available to extensions
const vscodeImpl = {
    window: {
        showInformationMessage: (msg) => {
            sendResponse({ type: 'notification', level: 'info', message: msg });
        },
        showErrorMessage: (msg) => {
            sendResponse({ type: 'notification', level: 'error', message: msg });
        },
        showWarningMessage: (msg) => {
            sendResponse({ type: 'notification', level: 'warning', message: msg });
        },
        createTextEditorDecorationType: () => ({ dispose: () => { } }),
        createOutputChannel: (name) => ({
            name,
            append: (val) => console.error(`[Output:${name}] ${val}`),
            appendLine: (val) => console.error(`[Output:${name}] ${val}`),
            clear: () => { },
            show: () => { },
            hide: () => { },
            dispose: () => { }
        }),
        get activeTextEditor() {
            if (vscodeImpl.workspace.textDocuments.length > 0) {
                return { 
                    document: vscodeImpl.workspace.textDocuments[0],
                    setDecorations: () => {}
                };
            }
            return undefined;
        },
        visibleTextEditors: [],
        onDidChangeActiveTextEditor: (cb) => {
            eventHandlers.on('onDidChangeActiveTextEditor', cb);
            return { dispose: () => {} };
        }
    },
    commands: {
        registerCommand: (id, callback) => {
            commands.set(id, callback);
            sendResponse({ type: 'commandRegistered', id });
            return { dispose: () => commands.delete(id) };
        },
        executeCommand: async (id, ...args) => {
            return await sendRequest({ type: 'executeCommand', id, args });
        }
    },
    workspace: {
        textDocuments: [],
        rootPath: process.cwd(),
        workspaceFolders: [{ uri: { fsPath: process.cwd() }, name: path.basename(process.cwd()), index: 0 }],
        fs: {
            readFile: async (uri) => {
                return await sendRequest({ type: 'workspace.readFile', uri });
            },
            stat: async (uri) => {
                return await sendRequest({ type: 'workspace.stat', uri });
            }
        },
        getConfiguration: (section) => {
            return {
                get: (key) => undefined,
                has: (key) => false,
                update: (key, value) => { },
                inspect: (key) => undefined
            };
        },
        onDidChangeTextDocument: (callback) => {
            eventHandlers.on('onDidChangeTextDocument', callback);
            return { dispose: () => { } };
        },
        onDidOpenTextDocument: (callback) => {
            eventHandlers.on('onDidOpenTextDocument', callback);
            return { dispose: () => { } };
        }
    },
    languages: {
        registerCompletionItemProvider: () => ({ dispose: () => {} }),
        registerDefinitionProvider: () => ({ dispose: () => {} }),
        registerHoverProvider: () => ({ dispose: () => {} }),
        createDiagnosticCollection: () => ({ 
            set: () => {}, 
            delete: () => {}, 
            clear: () => {}, 
            dispose: () => {} 
        })
    },
    env: {
        language: 'en',
        appName: 'VSCodium Rust',
        appRoot: __dirname,
        machineId: '1234',
        sessionId: '5678'
    },
    scm: {
        createSourceControl: (id, label) => ({
            id, label, 
            createResourceGroup: () => ({ resourceStates: [], dispose: () => {} }),
            dispose: () => {}
        })
    },
    version: '1.85.0'
};

// Simple event emitter
const eventHandlers = {
    handlers: new Map(),
    on(event, cb) {
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event).push(cb);
    },
    emit(event, ...args) {
        (this.handlers.get(event) || []).forEach(cb => cb(...args));
    }
};

const vscode = createStubProxy(vscodeImpl);

// Global for extensions to access
global.vscode = vscode;

const commands = new Map();
const extensions = new Map();

function sendResponse(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line) => {
    try {
        const request = JSON.parse(line);
        handleRequest(request);
    } catch (e) {
        sendResponse({ type: 'error', message: 'Failed to parse request: ' + e.message });
    }
});

function handleRequest(req) {
    switch (req.type) {
        case 'bootstrap':
            bootstrap(req.extensions);
            break;
        case 'activateExtension':
            const extId = req.id;
            const extension = loadedExtensions.get(extId);
            if (extension) {
                try {
                    const mainPath = path.join(extension.extensionPath, extension.main);
                    const extModule = require(mainPath);
                    if (extModule.activate) {
                        const context = { subscriptions: [] }; // Mock context
                        extModule.activate(context);
                        console.error(`Extension activated: ${extId}`);
                    }
                } catch (e) {
                    console.error(`Failed to activate extension ${extId}: ${e}`);
                }
            } else {
                console.error(`Extension not found: ${extId}`);
            }
            break;
        case 'documentOpened':
            const doc = { uri: req.uri, content: req.content, languageId: req.languageId };
            vscode.workspace.textDocuments.push(doc);
            eventHandlers.emit('onDidOpenTextDocument', doc);
            break;
        case 'documentChanged':
            const existingDoc = vscode.workspace.textDocuments.find(d => d.uri === req.uri);
            if (existingDoc) {
                existingDoc.content = req.content;
                eventHandlers.emit('onDidChangeTextDocument', { document: existingDoc });
            }
            break;
        case 'ping':
            sendResponse({ type: 'pong' });
            break;
        case 'executeCommand':
            const cmd = commands.get(req.id);
            if (cmd) {
                try {
                    cmd(...(req.args || []));
                } catch (e) {
                    sendResponse({ type: 'error', message: `Command ${req.id} failed: ${e.message}` });
                }
            } else {
                sendResponse({ type: 'error', message: `Command ${req.id} not found` });
            }
            break;
        case 'load_extension':
            const meta = req.metadata;
            if (meta && meta.id) {
                loadedExtensions.set(meta.id, meta);
                console.error(`Dynamic extension loaded: ${meta.id}`);
                // Check for eager activation
                if (meta.activationEvents && meta.activationEvents.includes('*')) {
                    activateExtension(meta.id);
                }
            }
            break;
        default:
            sendResponse({ type: 'error', message: `Unknown request type: ${req.type}` });
    }
}

const loadedExtensions = new Map();

async function bootstrap(extensionMetadataList) {
    for (const meta of extensionMetadataList) {
        loadedExtensions.set(meta.id, meta);

        // Check for eager activation (e.g. *)
        if (meta.activationEvents && meta.activationEvents.includes('*')) {
            await activateExtension(meta.id);
        }
    }
    sendResponse({ type: 'ready', count: loadedExtensions.size });
}

async function activateExtension(extId) {
    const meta = loadedExtensions.get(extId);
    if (!meta) return;

    if (extensions.has(extId)) return; // Already activated

    try {
        const extPath = meta.extensionPath;
        const mainFile = path.resolve(extPath, meta.main);

        const extension = require(mainFile);

        if (extension && typeof extension.activate === 'function') {
            const context = {
                subscriptions: [],
                extensionPath: extPath
            };
            await extension.activate(context);
            extensions.set(extId, { metadata: meta, instance: extension, context });
            console.error(`Extension ${meta.id} activated`);
        }
    } catch (e) {
        console.error(`Failed to activate extension ${meta.id}:`, e);
    }
}

function sendRequest(req) {
    return new Promise((resolve, reject) => {
        // Simple one-way for now, assuming no response needed immediately or handled via events
        // In a real system we'd use IDs to correlate
        sendResponse(req);
        resolve();
    });
}
