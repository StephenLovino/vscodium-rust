import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface EditorTab {
    id: string;
    filename: string;
    path: string;
    content: string;
    isModified: boolean;
    language: string;
    type?: 'file' | 'settings';
}

export interface AgentStep {
    name: string;
    status: 'running' | 'success' | 'error';
}

export interface AgentMessage {
    role: 'user' | 'assistant';
    content: string;
    steps?: AgentStep[];
    files?: string[];
    artifacts?: { type: 'walkthrough' | 'task'; path: string }[];
}

export interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    is_expanded?: boolean;
    children?: FileEntry[];
}

interface AppState {
    // Layout State
    isSidebarOpen: boolean;
    activeSidebarView: string;
    isBottomPanelOpen: boolean;
    activePanelTab: string;
    isRightSidebarOpen: boolean;
    theme: string;
    sidebarWidth: number;
    rightSidebarWidth: number;
    bottomPanelHeight: number;

    // Editor State
    activeTabId: string | null;
    tabs: EditorTab[];
    fileTree: FileEntry[];
    aiStatus: 'alive' | 'dead';
    tokenUsage: number; // 0 to 100
    iconThemeMapping: any;
    agentMode: string;
    agentModel: string;
    activeRoot: string | null;
    activeRootName: string | null;
    activeDevice: string | null;
    emulators: string[];
    availableModels: { id: string, provider: string }[];
    extensionContributions: any;
    mitmStatus: 'idle' | 'running' | 'error';
    mitmLogs: string[];
    mcpServers: string[];
    ollamaStatus: 'idle' | 'checking' | 'running' | 'error';
    agentMessages: AgentMessage[];
    isAgentThinking: boolean;
    isCommandPaletteOpen: boolean;
    isContextMenuOpen: boolean;
    isDebugToolbarOpen: boolean;
    contextMenuPosition: { x: number, y: number };
    commandPaletteQuery: string;
    cyberMode: boolean;
    ollamaUrl: string;

    // Actions
    toggleSidebar: () => void;
    setActiveSidebarView: (view: string) => void;
    toggleBottomPanel: () => void;
    setActivePanelTab: (tab: string) => void;
    toggleRightSidebar: () => void;
    setTheme: (theme: string) => void;
    setSidebarWidth: (width: number) => void;
    setRightSidebarWidth: (width: number) => void;
    setBottomPanelHeight: (height: number) => void;
    setFileTree: (tree: FileEntry[]) => void;
    setAiStatus: (status: 'alive' | 'dead') => void;
    setTokenUsage: (usage: number) => void;
    setIconThemeMapping: (mapping: any) => void;
    setAgentMode: (mode: string) => void;
    setAgentModel: (model: string) => void;
    setActiveRoot: (path: string | null) => void;
    setActiveDevice: (id: string | null) => void;
    setEmulators: (ems: string[]) => void;
    setExtensionContributions: (contributions: any) => void;
    refreshAvailableModels: (provider?: string) => Promise<void>;
    refreshFileTree: () => Promise<void>;
    toggleDirectory: (path: string) => Promise<void>;
    closeFolder: () => void;
    openFile: (path: string) => Promise<void>;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    updateTabContent: (id: string, content: string) => void;
    saveActiveFile: () => Promise<void>;
    setCyberMode: (enabled: boolean) => void;
    setOllamaUrl: (url: string) => void;
    openSettings: () => void;

    // Backend Actions
    backendPing: () => Promise<string>;
    startMitm: () => Promise<void>;
    stopMitm: () => Promise<void>;
    addMitmLog: (log: string) => void;
    registerMcpServer: (name: string, command: string, args: string[]) => Promise<void>;
    listMcpServers: () => Promise<void>;
    addAgentMessage: (role: 'user' | 'assistant', content: string) => void;
    updateLastAgentMessage: (content: string) => void;
    addAgentStep: (name: string) => void;
    updateAgentStepStatus: (name: string, status: 'running' | 'success' | 'error') => void;
    addAgentFile: (path: string) => void;
    addAgentArtifact: (type: 'walkthrough' | 'task', path: string) => void;
    setIsAgentThinking: (isThinking: boolean) => void;
    clearAgentMessages: () => void;
    truncateAgentMessages: (index: number) => void;
    setCommandPaletteOpen: (open: boolean) => void;
    setContextMenuOpen: (open: boolean, x?: number, y?: number) => void;
    setDebugToolbarOpen: (open: boolean) => void;
    setCommandPaletteQuery: (query: string) => void;
}

function detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        rs: 'rust', ts: 'typescript', tsx: 'typescript', js: 'javascript',
        jsx: 'javascript', json: 'json', css: 'css', html: 'html',
        md: 'markdown', toml: 'toml', yaml: 'yaml', yml: 'yaml',
        sh: 'shell', py: 'python', go: 'go', c: 'c', cpp: 'cpp',
        h: 'c', hpp: 'cpp', txt: 'plaintext',
    };
    return map[ext] ?? 'plaintext';
}

export const useStore = create<AppState>((set, get) => ({
    // Initial Layout State
    isSidebarOpen: true,
    activeSidebarView: 'explorer-view',
    // Start with a clean workspace: panel closed by default
    isBottomPanelOpen: false,
    activePanelTab: 'TERMINAL',
    isRightSidebarOpen: false,
    theme: 'vs-dark',
    sidebarWidth: parseInt(localStorage.getItem('sidebarWidth') || '260'),
    rightSidebarWidth: parseInt(localStorage.getItem('rightSidebarWidth') || '300'),
    bottomPanelHeight: parseInt(localStorage.getItem('bottomPanelHeight') || '240'),

    // Initial Editor State
    activeTabId: null,
    tabs: [],
    fileTree: [],
    aiStatus: 'alive',
    tokenUsage: 0,
    iconThemeMapping: null,
    agentMode: 'Planning',
    agentModel: 'Google|gemini-1.5-pro', // Match internal value format
    activeRoot: localStorage.getItem('activeRoot'),
    activeRootName: localStorage.getItem('activeRootName'),
    activeDevice: null,
    emulators: [],
    availableModels: [],
    extensionContributions: {
        viewsContainers: { activitybar: [] },
        views: {}
    },
    mitmStatus: 'idle',
    mitmLogs: [],
    mcpServers: [],
    ollamaStatus: 'idle',
    agentMessages: [],
    isAgentThinking: false,
    isCommandPaletteOpen: false,
    isContextMenuOpen: false,
    isDebugToolbarOpen: false,
    contextMenuPosition: { x: 0, y: 0 },
    commandPaletteQuery: '',
    cyberMode: false,
    ollamaUrl: 'http://127.0.0.1:11434',

    // Actions
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setActiveSidebarView: (view) => set(() => ({ activeSidebarView: view, isSidebarOpen: true })),
    toggleBottomPanel: () => set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen })),
    setActivePanelTab: (tab) => set(() => ({ activePanelTab: tab, isBottomPanelOpen: true })),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
    setTheme: (theme) => set({ theme }),
    setSidebarWidth: (sidebarWidth) => {
        localStorage.setItem('sidebarWidth', sidebarWidth.toString());
        set({ sidebarWidth });
    },
    setRightSidebarWidth: (rightSidebarWidth) => {
        localStorage.setItem('rightSidebarWidth', rightSidebarWidth.toString());
        set({ rightSidebarWidth });
    },
    setBottomPanelHeight: (bottomPanelHeight) => {
        localStorage.setItem('bottomPanelHeight', bottomPanelHeight.toString());
        set({ bottomPanelHeight });
    },
    setFileTree: (tree) => set({ fileTree: tree }),
    setAiStatus: (aiStatus) => set({ aiStatus }),
    setTokenUsage: (tokenUsage) => set({ tokenUsage }),
    setIconThemeMapping: (iconThemeMapping) => set({ iconThemeMapping }),
    setAgentMode: (agentMode) => set({ agentMode }),
    setAgentModel: (agentModel) => set({ agentModel }),
    setActiveRoot: (path) => {
        if (path) {
            const name = path.replace(/\\/g, '/').split('/').pop() || path;
            localStorage.setItem('activeRoot', path);
            localStorage.setItem('activeRootName', name);
            set({ activeRoot: path, activeRootName: name });
        } else {
            localStorage.removeItem('activeRoot');
            localStorage.removeItem('activeRootName');
            set({ activeRoot: null, activeRootName: null, fileTree: [] });
        }
    },
    setActiveDevice: (activeDevice) => set({ activeDevice }),
    setEmulators: (emulators) => set({ emulators }),
    setExtensionContributions: (extensionContributions) => set({ extensionContributions }),
    setCyberMode: (enabled) => set({ cyberMode: enabled }),
    setOllamaUrl: (url) => {
        set({ ollamaUrl: url });
        invoke('set_ollama_url', { url }).catch(console.error);
    },

    refreshFileTree: async () => {
        try {
            const tree = await invoke<FileEntry[]>('get_file_tree');
            set({ fileTree: tree });
        } catch (error) {
            console.error('Refresh File Tree Error:', error);
            // If it fails because no root is set, clear the tree
            set({ fileTree: [] });
        }
    },

    closeFolder: () => {
        localStorage.removeItem('activeRoot');
        localStorage.removeItem('activeRootName');
        invoke('set_active_root', { path: null });
        set({ activeRoot: null, activeRootName: null, fileTree: [] });
    },
    showWelcomeTab: () => {
        const { openFile } = get().activeTabId !== undefined ? get() : { openFile: (p:string) => {} };
        (get() as any).openFile('Welcome');
    },

    openFile: async (path: string) => {
        const existingTab = get().tabs.find(t => t.path === path);
        if (existingTab) {
            set({ activeTabId: existingTab.id });
            return;
        }
        try {
            const content = await invoke<string>('read_file', { path });
            const filename = path.replace(/\\/g, '/').split('/').pop() ?? path;
            const id = `tab-${Date.now()}-${Math.random()}`;
            const tab: EditorTab = { id, filename, path, content, isModified: false, language: detectLanguage(filename) };
            set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
        } catch (error) {
            console.error('Open File Error:', error);
        }
    },

    closeTab: (id: string) => {
        set((state) => {
            const tabs = state.tabs.filter(t => t.id !== id);
            let activeTabId = state.activeTabId;
            if (activeTabId === id) {
                activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
            }
            return { tabs, activeTabId };
        });
    },

    setActiveTab: (id: string) => set({ activeTabId: id }),

    updateTabContent: (id: string, content: string) => {
        set((state) => ({
            tabs: state.tabs.map(t => t.id === id ? { ...t, content, isModified: true } : t),
        }));
    },

    saveActiveFile: async () => {
        const { tabs, activeTabId } = get();
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab || tab.type === 'settings') return;
        try {
            await invoke('write_file', { path: tab.path, content: tab.content });
            set((state) => ({
                tabs: state.tabs.map(t => t.id === activeTabId ? { ...t, isModified: false } : t),
            }));
        } catch (error) {
            console.error('Save File Error:', error);
        }
    },

    openSettings: () => {
        const settingsTab = get().tabs.find(t => t.type === 'settings');
        if (settingsTab) {
            set({ activeTabId: settingsTab.id });
            return;
        }
        const id = 'settings-tab';
        const tab: EditorTab = {
            id,
            filename: 'Settings',
            path: 'vscode://settings',
            content: '',
            isModified: false,
            language: '',
            type: 'settings'
        };
        set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
    },

    // Backend Actions
    backendPing: async () => {
        try {
            return await invoke<string>('backend_ping');
        } catch (error) {
            console.error('Backend Ping Error:', error);
            return `Error: ${error}`;
        }
    },

    refreshAvailableModels: async (targetProvider?: string) => {
        const { ollamaUrl } = get();
        try {
            const keys: any = await invoke('get_api_keys');
            const providers: string[] = [];
            if (keys.google) providers.push('Google');
            if (keys.anthropic) providers.push('Anthropic');
            if (keys.openai) providers.push('OpenAI');
            if (keys.openrouter) providers.push('Openrouter');
            if (keys.mistral) providers.push('Mistral');
            if (keys.groq) providers.push('Groq');
            if (keys.xai) providers.push('xAI');
            if (keys.alibaba) providers.push('Alibaba');
            providers.push('ApiRadar'); // Always include for aggregated view
            
            // Always try Ollama if requested or by default
            if (targetProvider === 'ollama' || !targetProvider) {
                providers.push('Ollama');
            }

            let allModels: { id: string, provider: string }[] = [];
            
            // Fix case sensitivity and provider mapping
            const activeProviders = targetProvider 
                ? [targetProvider.toLowerCase() === 'apiradar' ? 'ApiRadar' : targetProvider.charAt(0).toUpperCase() + targetProvider.slice(1).toLowerCase()] 
                : providers;

            for (const p of activeProviders) {
                try {
                    if (p.toLowerCase() === 'ollama') {
                        // Ensure backend has the latest URL before listing
                        await invoke('set_ollama_url', { url: ollamaUrl });
                    }
                    const models = await invoke<string[]>('list_provider_models', { provider: p });
                    allModels = [...allModels, ...models.map(m => ({ id: m, provider: p.toLowerCase() }))];
                    if (p.toLowerCase() === 'ollama' && models.length > 0) set({ ollamaStatus: 'running' });
                } catch (e: any) {
                    // Suppress common error when a provider key is simply missing
                    if (e && typeof e === 'string' && e.includes('API key not found')) {
                        // Silent skip
                    } else {
                        console.error(`Failed to fetch models for ${p}:`, e);
                    }
                    if (p.toLowerCase() === 'ollama') set({ ollamaStatus: 'error' });
                }
            }
            
            set((state) => {
                let currentModels = [...state.availableModels];
                
                if (targetProvider) {
                    // Refreshing only ONE provider: remove its old models
                    currentModels = currentModels.filter(m => m.provider !== targetProvider.toLowerCase());
                } else {
                    // Refreshing ALL: remove everything except Ollama if it was already running and not being refreshed
                    // Actually, since practitioners often have many Ollama models, we should only keep them if they are still valid.
                    // But for simplicity, if targetProvider is null (full refresh), we start fresh except for Ollama which we might want to preserve 
                    // if it takes long to fetch. However, list_provider_models is fast.
                    currentModels = []; 
                }
                
                // Add newly fetched models, ensuring NO duplicates by ID
                const newModels = allModels.filter(nm => !currentModels.some(cm => cm.id === nm.id && cm.provider === nm.provider));
                
                return { 
                    availableModels: [...currentModels, ...newModels],
                    lastRefresh: Date.now()
                };
            });
        } catch (e) {
            console.error('Refresh Available Models Error:', e);
        }
    },

    startMitm: async () => {
        try {
            set({ mitmStatus: 'running' });
            await invoke('start_mitm_server');
            get().addMitmLog('Proxy server started on port 8080');
        } catch (e: any) {
            set({ mitmStatus: 'error' });
            get().addMitmLog(`Error: ${e}`);
        }
    },

    stopMitm: async () => {
        try {
            await invoke('stop_mitm_server');
            set({ mitmStatus: 'idle' });
            get().addMitmLog('Proxy server stopped');
        } catch (e: any) {
            get().addMitmLog(`Error stopping server: ${e}`);
        }
    },

    addMitmLog: (log) => set((state) => ({ 
        mitmLogs: [...state.mitmLogs, `[${new Date().toLocaleTimeString()}] ${log}`].slice(-100) 
    })),

    registerMcpServer: async (name, command, args) => {
        try {
            await invoke('register_mcp_server', { name, command, args });
            await get().listMcpServers();
        } catch (e) {
            console.error('Register MCP Server Error:', e);
        }
    },

    listMcpServers: async () => {
        try {
            const servers = await invoke<string[]>('list_mcp_servers');
            set({ mcpServers: servers });
        } catch (e) {
            console.error('List MCP Servers Error:', e);
        }
    },
    addAgentMessage: (role, content) => set((state) => ({ 
        agentMessages: [...state.agentMessages, { role, content, steps: role === 'assistant' ? [] : undefined }] 
    })),
    updateLastAgentMessage: (content) => set((state) => {
        const messages = [...state.agentMessages];
        const lastIndex = messages.length - 1;
        const last = messages[lastIndex];
        if (last && last.role === 'assistant') {
            messages[lastIndex] = { ...last, content };
        }
        return { agentMessages: messages };
    }),
    addAgentStep: (name) => set((state) => {
        const messages = [...state.agentMessages];
        const last = messages[messages.length - 1];
        if (last && last.role === 'assistant') {
            last.steps = [...(last.steps || []), { name, status: 'running' }];
        }
        return { agentMessages: messages };
    }),
    updateAgentStepStatus: (name, status) => set((state) => {
        const messages = [...state.agentMessages];
        const last = messages[messages.length - 1];
        if (last && last.role === 'assistant' && last.steps) {
            const step = last.steps.find(s => s.name === name);
            if (step) step.status = status;
        }
        return { agentMessages: messages };
    }),
    setIsAgentThinking: (isAgentThinking) => set({ isAgentThinking }),
    addAgentFile: (path: string) => {
        set((state) => {
            const last = state.agentMessages[state.agentMessages.length - 1];
            if (last && last.role === 'assistant') {
                const files = last.files || [];
                if (!files.includes(path)) {
                    const newMessages = [...state.agentMessages];
                    newMessages[newMessages.length - 1] = { ...last, files: [...files, path] };
                    return { agentMessages: newMessages };
                }
            }
            return state;
        });
    },
    addAgentArtifact: (type, path) => {
        set((state) => {
            const last = state.agentMessages[state.agentMessages.length - 1];
            if (last && last.role === 'assistant') {
                const artifacts = last.artifacts || [];
                if (!artifacts.find(a => a.path === path)) {
                    const newMessages = [...state.agentMessages];
                    newMessages[newMessages.length - 1] = { ...last, artifacts: [...artifacts, { type, path }] };
                    return { agentMessages: newMessages };
                }
            }
            return state;
        });
    },
    clearAgentMessages: () => set({ agentMessages: [] }),
    truncateAgentMessages: (index: number) => set((state) => ({ 
        agentMessages: state.agentMessages.slice(0, index) 
    })),
    setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
    setContextMenuOpen: (isContextMenuOpen, x = 0, y = 0) => set({ isContextMenuOpen, contextMenuPosition: { x, y } }),
    setDebugToolbarOpen: (isDebugToolbarOpen) => set({ isDebugToolbarOpen }),
    setCommandPaletteQuery: (commandPaletteQuery) => set({ commandPaletteQuery }),
    toggleDirectory: async (path: string) => {
        const state = get();
        const node = findNodeRecursive(state.fileTree, path);
        if (!node) return;

        const is_now_expanded = !node.is_expanded;
        
        const updateExpansionRecursive = (nodes: FileEntry[]): FileEntry[] => {
            return nodes.map(n => {
                if (n.path === path) return { ...n, is_expanded: is_now_expanded };
                if (n.children) return { ...n, children: updateExpansionRecursive(n.children) };
                return n;
            });
        };

        if (is_now_expanded && (!node.children || node.children.length === 0)) {
            try {
                const children = await invoke<FileEntry[]>('list_dir_flat', { path });
                const treeWithChildren = injectChildrenRecursive(state.fileTree, path, children);
                set({ fileTree: updateExpansionRecursive(treeWithChildren) });
            } catch (e) {
                console.error('Lazy load directory failed:', e);
                set({ fileTree: updateExpansionRecursive(state.fileTree) });
            }
        } else {
            set({ fileTree: updateExpansionRecursive(state.fileTree) });
        }
    },
}));

function findNodeRecursive(nodes: FileEntry[], path: string): FileEntry | null {
    for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
            const found = findNodeRecursive(node.children, path);
            if (found) return found;
        }
    }
    return null;
}

function injectChildrenRecursive(nodes: FileEntry[], path: string, children: FileEntry[]): FileEntry[] {
    return nodes.map(node => {
        if (node.path === path) {
            return { ...node, children };
        }
        if (node.children) {
            return { ...node, children: injectChildrenRecursive(node.children, path, children) };
        }
        return node;
    });
}

if (typeof window !== 'undefined') {
    (window as any).useStore = useStore;
}
