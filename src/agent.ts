import { invoke, listen } from './tauri_bridge.ts';
import { browserOpen, browserNavigate, browserScreenshot, browserClose } from './browser.ts';

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

let chatHistory: ChatMessage[] = [];

// providerModels is now managed by the store and backend discovery

let currentAgentProvider = "Google";
let currentAgentModel = "gemini-2.5-pro";
let currentAgentMode = "Planning";

function createPopover(x: number, y: number, items: { label: string, value: string, desc?: string }[], onSelect: (val: string, label: string) => void) {
    const existing = document.getElementById("agent-popover");
    if (existing) existing.remove();

    const popover = document.createElement("div");
    popover.id = "agent-popover";
    popover.style.position = "absolute";
    popover.style.left = `${x}px`;
    popover.style.bottom = `${window.innerHeight - y + 10}px`;
    popover.style.background = "#252526";
    popover.style.border = "1px solid #454545";
    popover.style.borderRadius = "6px";
    popover.style.boxShadow = "0 4px 14px rgba(0,0,0,0.5)";
    popover.style.padding = "4px 0";
    popover.style.zIndex = "9999";
    popover.style.minWidth = "220px";
    popover.style.maxHeight = "300px";
    popover.style.overflowY = "auto";
    popover.style.color = "#ccc";
    popover.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'system-ui', sans-serif";
    popover.style.fontSize = "12px";
    popover.style.pointerEvents = "auto";

    items.forEach(item => {
        const row = document.createElement("div");
        row.style.padding = "6px 12px";
        row.style.cursor = "pointer";
        row.style.display = "flex";
        row.style.flexDirection = "column";

        row.onmouseover = () => row.style.background = "#04395e";
        row.onmouseout = () => row.style.background = "transparent";

        row.onclick = (e) => {
            e.stopPropagation();
            onSelect(item.value, item.label);
            popover.remove();
        };

        const title = document.createElement("div");
        title.innerText = item.label;
        title.style.color = "#fff";
        row.appendChild(title);

        if (item.desc) {
            const desc = document.createElement("div");
            desc.innerText = item.desc;
            desc.style.fontSize = "11px";
            desc.style.color = "#999";
            desc.style.marginTop = "2px";
            row.appendChild(desc);
        }

        popover.appendChild(row);
    });

    document.body.appendChild(popover);

    setTimeout(() => {
        const closeListener = (e: MouseEvent) => {
            if (!popover.contains(e.target as Node)) {
                popover.remove();
                document.removeEventListener("click", closeListener);
            }
        };
        document.addEventListener("click", closeListener);
    }, 0);
}

export function openModeDropdown(element: HTMLElement, onSelect: (label: string) => void) {
    const rect = element.getBoundingClientRect();
    createPopover(rect.left, rect.top, [
        { label: "Planning", value: "Planning", desc: "Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work" },
        { label: "Planning (Source Control)", value: "Planning (Source Control)", desc: "Deep dive into git history and planning source control workflows" },
        { label: "Fast", value: "Fast", desc: "Agent will execute tasks directly. Use for simple tasks that can be completed faster" },
        { label: "Cybersecurity", value: "Cybersecurity", desc: "Unrestricted mode for exploit research, reverse engineering, and offensive programming." }
    ], (val) => {
        const store = (window as any).useStore;
        if (store) {
            store.getState().setAgentMode(val);
            if (val.includes("Source Control")) {
                store.getState().setActiveSidebarView('planning-view');
            }
        }
        onSelect(val);
    });
}

export async function initAgent() {
    console.log("Initializing Agent global listeners...");
    const { listen } = await import('@tauri-apps/api/event');
    
    listen('session-captured', (event: any) => {
        const { provider, cookies, userAgent } = event.payload;
        console.log(`Session captured for ${provider}`);
        
        const session = {
            provider,
            cookies,
            user_agent: userAgent
        };

        invoke("save_ai_session", { session }).then(() => {
            const store = (window as any).useStore;
            if (store) {
                store.getState().setAiStatus('alive');
                store.getState().refreshAvailableModels(provider);
                
                // Visual feedback
                const messagesContainer = document.getElementById("agent-messages");
                if (messagesContainer) {
                    const info = document.createElement("div");
                    info.className = "agent-message info-message-box";
                    info.style.background = "rgba(16, 185, 129, 0.1)";
                    info.style.border = "1px solid rgba(16, 185, 129, 0.2)";
                    info.style.color = "#10b981";
                    info.style.padding = "8px 12px";
                    info.style.margin = "8px 0";
                    info.style.borderRadius = "6px";
                    info.style.fontSize = "12px";
                    info.style.animation = "fadeIn 0.3s ease";
                    info.innerHTML = `<i class="codicon codicon-pass-filled"></i> Session for ${provider} synced successfully!`;
                    messagesContainer.appendChild(info);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }
        }).catch(err => {
            console.error("Failed to save AI session:", err);
        });
    });
}

export function openModelDropdown(element: HTMLElement, onSelect: (label: string) => void) {
    const rect = element.getBoundingClientRect();
    const store = (window as any).useStore;
    const availableModels = store ? store.getState().availableModels : [];
    const setAgentModel = store ? store.getState().setAgentModel : () => {};
    
    const items: { label: string, value: string, desc?: string }[] = [];

    if (availableModels && availableModels.length > 0) {
        availableModels.forEach((m: { id: string, provider: string }) => {
            const providerName = m.provider.toLowerCase();
            const providerLabel = providerName.charAt(0).toUpperCase() + providerName.slice(1);
            items.push({
                label: `${m.id} (${providerLabel})`,
                value: `${providerLabel}|${m.id}`
            });
        });
    }

    // Add local Ollama manual check if no models found (fallback)
    if (!items.find(i => i.value.startsWith("Ollama"))) {
        items.push({ label: "🛠️ Check Ollama (Local)", value: "action|check_ollama", desc: "Scan for local models on http://localhost:11434" });
    }

    // Always offer Hunting/Settings if list is low or empty
    if (items.length < 3) {
        items.push({ 
            label: "🛰️ Hunt for Working AI Keys", 
            value: "action|hunt", 
            desc: "Scans for leaked but alive API keys" 
        });
    }

    // Add Browser login options
    items.push({
        label: "☁️ Login to Claude (Browser)",
        value: "action|login|claude",
        desc: "Use your personal Claude.ai subscription"
    });
    items.push({
        label: "💎 Login to Gemini (Browser)",
        value: "action|login|gemini",
        desc: "Use your personal Gemini subscription"
    });
    
    if (items.length === 0) {
        items.push({ label: "⚙️ Add API keys in settings", value: "action|settings" });
    }

    createPopover(rect.left, rect.top, items, (val) => {
        if (val === "action|hunt") {
            startKeyHunt();
            return;
        }
        if (val === "action|check_ollama") {
            const store = (window as any).useStore;
            if (store) store.getState().refreshAvailableModels("ollama");
            return;
        }
    if (val.startsWith("action|login|")) {
        const provider = val.split("|")[2];
        invoke("open_ai_login", { provider }).catch(err => {
            console.error("Failed to open login window:", err);
        });
        return;
    }
        if (val === "action|settings") {
            // Trigger settings sidebar or view - assuming there's a global way or just open it
            const settingsBtn = document.querySelector('.codicon-settings') as HTMLElement;
            if (settingsBtn) settingsBtn.click();
            return;
        }
        if (val === "none") return;

        setAgentModel(val);
        onSelect(val);
    });
}

export function openContextDropdown(element: HTMLElement, onSelect: (label: string) => void) {
    const rect = element.getBoundingClientRect();
    createPopover(rect.left, rect.top, [
        { label: "Media", value: "media" },
        { label: "Mentions", value: "mentions" },
        { label: "Workflows", value: "workflows" }
    ], (val, label) => {
        onSelect(label);
    });
}

export async function handleAgentChat(inputElement: HTMLTextAreaElement) {
    const prompt = inputElement.value.trim();
    if (!prompt) return;

    inputElement.value = "";
    
    // Simple UI feedback: clear input and show message in history
    const messagesContainer = document.getElementById("agent-messages");
    if (messagesContainer) {
        // 1. User Message
        const userMsg = document.createElement("div");
        userMsg.className = "agent-message user-message-box";
        userMsg.innerText = prompt;
        messagesContainer.appendChild(userMsg);

        // 2. Thought Overlay (Collapsible)
        const thoughtOverlay = document.createElement("div");
        thoughtOverlay.className = "thought-overlay";
        
        const thoughtHeader = document.createElement("div");
        thoughtHeader.className = "thought-header";
        let seconds = 0;
        const startTime = Date.now();
        thoughtHeader.innerHTML = `<i class="codicon codicon-info" style="font-size: 14px;"></i> <span>Thought for 0s</span> <i class="codicon codicon-chevron-down" style="margin-left: auto; font-size: 10px; opacity: 0.5;"></i>`;
        thoughtOverlay.appendChild(thoughtHeader);

        const timerInterval = setInterval(() => {
            seconds = Math.floor((Date.now() - startTime) / 1000);
            const span = thoughtHeader.querySelector('span');
            if (span) span.innerText = `Thought for ${seconds}s`;
        }, 1000);

        const thoughtContent = document.createElement("div");
        thoughtContent.className = "thought-content";
        thoughtContent.style.display = "none";
        thoughtContent.innerText = "Analyzing project context, recent file changes, and planning the next steps to fulfill the user request...";
        thoughtOverlay.appendChild(thoughtContent);

        thoughtOverlay.onclick = () => {
            const isHidden = thoughtContent.style.display === "none";
            thoughtContent.style.display = isHidden ? "block" : "none";
            thoughtHeader.querySelector('.codicon-chevron-down')?.classList.toggle('codicon-chevron-up', isHidden);
        };
        
        messagesContainer.appendChild(thoughtOverlay);

        // 3. Assistant Message Box
        const assistantBox = document.createElement("div");
        assistantBox.className = "agent-message assistant-message-box";

        // 3.1 Progress Stepper
        const progressContainer = document.createElement("div");
        progressContainer.className = "progress-stepper";
        progressContainer.innerHTML = `
            <div class="progress-step"><div class="step-number">1</div><div class="step-content">Analyzing <b>vscodium-rust</b> codebase...</div></div>
            <div class="progress-step"><div class="step-number">2</div><div class="step-content">Planning implementation for <b>${prompt.slice(0, 20)}...</b></div></div>
        `;
        assistantBox.appendChild(progressContainer);
        
        const msgContent = document.createElement("div");
        msgContent.className = "message-content";
        msgContent.style.whiteSpace = "pre-wrap";
        msgContent.style.fontSize = "13px";
        msgContent.style.lineHeight = "1.5";
        msgContent.innerText = "Thinking...";
        assistantBox.appendChild(msgContent);

        // 4. Actions Bar
        const actionsBar = document.createElement("div");
        actionsBar.className = "agent-actions-bar";
        
        const createAction = (icon: string, label: string, onClick: () => void) => {
            const item = document.createElement("div");
            item.className = "action-item";
            item.innerHTML = `<i class="codicon codicon-${icon}"></i> <span>${label}</span>`;
            item.onclick = onClick;
            return item;
        };

        const copyAction = createAction("copy", "Copy", () => {
            navigator.clipboard.writeText(msgContent.innerText);
            const span = copyAction.querySelector('span');
            if (span) span.innerText = "Copied!";
            setTimeout(() => { if (span) span.innerText = "Copy"; }, 2000);
        });

        actionsBar.appendChild(copyAction);
        actionsBar.appendChild(createAction("thumbsup", "", () => {}));
        actionsBar.appendChild(createAction("thumbsdown", "", () => {}));
        
        assistantBox.appendChild(actionsBar);
        messagesContainer.appendChild(assistantBox);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            await sendAgentMessage(prompt, (msg) => {
                clearInterval(timerInterval);
                msgContent.innerText = msg;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        } catch (err: any) {
            clearInterval(timerInterval);
            msgContent.innerHTML = `<div style="color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 12px; border-radius: 6px; border: 1px solid rgba(248, 113, 113, 0.2);">
                <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <i class="codicon codicon-error"></i> Execution Failed
                </div>
                <div style="font-size: 12px; opacity: 0.8; font-family: var(--font-mono);">${err.message || err}</div>
            </div>`;
        }
    }
}

export async function sendAgentMessage(userPrompt: string, _onUpdate: (msg: string) => void): Promise<void> {
    const store = (window as any).useStore;
    if (!store) throw new Error("Store not found");

    // Handle Slash Commands
    if (userPrompt.startsWith('/')) {
        const handled = await processSlashCommand(userPrompt);
        if (handled) return;
    }
    
    const { agentModel, agentMessages, setAiStatus, availableModels } = store.getState();
    
    // Determine provider and model
    let provider = "OpenAI";
    let model = agentModel;

    // 1. Try to find in availableModels list (most reliable)
    const found = availableModels?.find((m: any) => m.id === agentModel || `${m.provider}|${m.id}` === agentModel);
    if (found) {
        provider = found.provider;
        model = found.id;
    } 
    // 2. Fallback to format parsing etc.
    else if (agentModel.includes("|")) {
        [provider, model] = agentModel.split("|");
    } else if (agentModel.toLowerCase().includes("goog") || agentModel.toLowerCase().includes("gemini")) {
        provider = "Google";
    } else if (agentModel.toLowerCase().includes("anthropic") || agentModel.toLowerCase().includes("claude")) {
        provider = "Anthropic";
    } else if (agentModel.toLowerCase().includes("ollama") || agentModel.includes("/") || agentModel.includes(":")) {
        // Deep local model detection (Ollama often uses slashes and colons)
        provider = "Ollama";
    }

    // Normalized provider for backend
    const normalizedProvider = provider.toLowerCase() === 'apiradar' ? 'apiradar' : provider.toLowerCase();

    // Map messages to the format expected by the backend
    const messages = agentMessages.map((m: any) => ({
        role: m.role,
        content: m.content || "",
        tool_calls: null,
        metadata: null
    }));

    setAiStatus('alive');

    try {
        await invoke<string>("ai_chat", {
            request: {
                provider: normalizedProvider,
                model: model,
                messages: messages,
                temperature: 0.7,
                autonomous: true,
                cyber_mode: store.getState().cyberMode,
                ollama_url: store.getState().ollamaUrl
            }
        });
    } catch (e: any) {
        console.error("Agent chat failed:", e);
        setAiStatus('dead');
        throw e;
    }
}

async function processSlashCommand(prompt: string): Promise<boolean> {
    const command = prompt.split(' ')[0].toLowerCase();
    const store = (window as any).useStore;
    if (!store) return false;

    const { addAgentMessage, clearAgentMessages, activeRoot } = store.getState();

    switch (command) {
        case '/clear':
            clearAgentMessages();
            return true;
        case '/settings':
            // Logic handled by UI usually, but we can force it
            const settingsBtn = document.querySelector('.codicon-settings-gear') as HTMLElement;
            if (settingsBtn) settingsBtn.click();
            return true;
        case '/workflows':
            addAgentMessage('assistant', "Searching for available workflows...");
            if (!activeRoot) {
                store.getState().updateLastAgentMessage("Error: No active root directory found.");
                return true;
            }
            try {
                const paths = [`${activeRoot}/.agent/workflows`, `${activeRoot}/.agents/workflows`];
                let allWfs: any[] = [];
                for (const p of paths) {
                    try {
                        const entries = await invoke<any[]>("list_directory", { path: p });
                        allWfs = [...allWfs, ...entries.filter(e => !e.is_dir && e.name.endsWith('.md'))];
                    } catch (e) {}
                }
                
                if (allWfs.length === 0) {
                    store.getState().updateLastAgentMessage("No workflows found in `.agent/workflows` or `.agents/workflows`.");
                } else {
                    const list = allWfs.map(w => `- [${w.name}](file://${w.path})`).join('\n');
                    store.getState().updateLastAgentMessage(`### Available Workflows:\n${list}\n\nClick a workflow or type its name to execute.`);
                }
            } catch (err: any) {
                store.getState().updateLastAgentMessage(`Error listing workflows: ${err.message}`);
            }
            return true;
        case '/help':
            const helpMsg = `### Antigravity Slash Commands:
- \`/clear\`: Wipe current chat history.
- \`/settings\`: Toggle the AI configuration panel.
- \`/workflows\`: List all automated workflows in your project.
- \`/help\`: Show this list.`;
            addAgentMessage('assistant', helpMsg);
            return true;
        default:
            return false; // Not a handled slash command
    }
}

function parseToolCall(text: string) {
    if (!text) return null;
    const browserOpenMatch = text.match(/\[BROWSER_OPEN\]/);
    if (browserOpenMatch) return { type: "BROWSER_OPEN" };

    const browserNavigateMatch = text.match(/\[BROWSER_NAVIGATE:\s*([^\]]+)\]/);
    if (browserNavigateMatch) return { type: "BROWSER_NAVIGATE", arg: browserNavigateMatch[1].trim() };

    const browserScreenshotMatch = text.match(/\[BROWSER_SCREENSHOT\]/);
    if (browserScreenshotMatch) return { type: "BROWSER_SCREENSHOT" };

    const browserCloseMatch = text.match(/\[BROWSER_CLOSE\]/);
    if (browserCloseMatch) return { type: "BROWSER_CLOSE" };

    const execCommandMatch = text.match(/\[EXEC_COMMAND:\s*([^\]]+)\]/);
    if (execCommandMatch) return { type: "EXEC_COMMAND", arg: execCommandMatch[1].trim() };

    const modifyFileMatch = text.match(/\[MODIFY_FILE:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/);
    if (modifyFileMatch) return {
        type: "MODIFY_FILE",
        path: modifyFileMatch[1].trim(),
        target: modifyFileMatch[2].trim(),
        replacement: modifyFileMatch[3].trim()
    };

    const runCommandMatch = text.match(/\[RUN_COMMAND:\s*([^\]]+)\]/);
    if (runCommandMatch) return { type: "RUN_COMMAND", arg: runCommandMatch[1].trim() };

    const searchFilesMatch = text.match(/\[SEARCH_FILES:\s*([^\]]+)\]/);
    if (searchFilesMatch) return { type: "SEARCH_FILES", arg: searchFilesMatch[1].trim() };

    const listFilesMatch = text.match(/\[LIST_FILES:\s*([^\]]+)\]/);
    if (listFilesMatch) return { type: "LIST_FILES", arg: listFilesMatch[1].trim(), recursive: text.includes("| recursive") };

    const readFileMatch = text.match(/\[READ_FILE:\s*([^\]]+)\]/);
    if (readFileMatch) return { type: "READ_FILE", arg: readFileMatch[1].trim() };

    const createFileMatch = text.match(/\[CREATE_FILE:\s*([^\]]+)\]/);
    if (createFileMatch) return { type: "CREATE_FILE", arg: createFileMatch[1].trim() };

    const createDirMatch = text.match(/\[CREATE_DIR:\s*([^\]]+)\]/);
    if (createDirMatch) return { type: "CREATE_DIR", arg: createDirMatch[1].trim() };

    return null;
}

async function executeTool(tool: any): Promise<string> {
    try {
        switch (tool.type) {
            case "BROWSER_OPEN":
                return await invoke("browser_open");
            case "BROWSER_NAVIGATE":
                return await invoke("browser_navigate", { url: tool.arg });
            case "BROWSER_SCREENSHOT":
                const b64 = await invoke<string>("browser_screenshot");
                return "Screenshot captured and stored in memory (Base64 omitted from log).";
            case "BROWSER_CLOSE":
                return await invoke("browser_close");
            case "EXEC_COMMAND":
                return await invoke("ai_execute_command", { command: tool.arg });
            case "MODIFY_FILE":
                await invoke("ai_modify_file", { path: tool.path, target: tool.target, replacement: tool.replacement });
                return `Successfully modified ${tool.path}`;
            case "OPEN_FILE":
                return await invoke("open_file", { path: tool.arg });
            case "CREATE_FILE":
                await invoke("create_file", { path: tool.arg });
                return `Successfully created file: ${tool.arg}`;
            case "CREATE_DIR":
                await invoke("create_dir", { path: tool.arg });
                return `Successfully created directory: ${tool.arg}`;
            case "RUN_COMMAND":
                return await invoke("ai_execute_command", { command: tool.arg });
            case "SEARCH_FILES":
                const searchRes = await invoke<any[]>("search_project", { query: tool.arg });
                return JSON.stringify(searchRes);
            case "LIST_FILES":
                const listRes = await invoke<any>("list_directory", { path: tool.arg });
                return JSON.stringify(listRes);
            case "READ_FILE":
                return await invoke("read_file", { path: tool.arg });
            default:
                return "Unknown tool";
        }
    } catch (e) {
        return `Tool Error: ${e}`;
    }
}
export async function startKeyHunt() {
    const messagesContainer = document.getElementById("agent-messages");
    if (!messagesContainer) return;

    // 1. Create Hunting Bubble
    const huntBox = document.createElement("div");
    huntBox.className = "agent-message assistant-message-box";
    huntBox.style.borderColor = "#60a5fa";
    huntBox.style.background = "rgba(59, 130, 246, 0.05)";
    
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";
    title.style.marginBottom = "8px";
    title.style.color = "#60a5fa";
    title.innerHTML = `<i class="codicon codicon-radar" style="animation: spin 2s linear infinite;"></i> AI Key Hunt in Progress...`;
    huntBox.appendChild(title);

    const logContent = document.createElement("div");
    logContent.style.fontSize = "11px";
    logContent.style.fontFamily = "var(--font-mono)";
    logContent.style.opacity = "0.7";
    logContent.style.maxHeight = "150px";
    logContent.style.overflowY = "auto";
    logContent.style.lineHeight = "1.6";
    huntBox.appendChild(logContent);

    messagesContainer.appendChild(huntBox);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const addLog = (msg: string) => {
        const line = document.createElement("div");
        line.innerHTML = msg.replace(/\n/g, "<br>");
        logContent.appendChild(line);
        logContent.scrollTop = logContent.scrollHeight;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // 2. Setup Listeners
    const unlistenProgress = await listen("hunt-progress", (event: any) => {
        addLog(event.payload.msg);
    });

    const unlistenFound = await listen("hunt-found", (event: any) => {
        addLog(`<span style="color: #4ade80;">✨ ${event.payload.msg}</span>`);
    });

    try {
        const results: any[] = await invoke("hunt_api_keys");
        unlistenProgress();
        unlistenFound();

        if (results.length > 0) {
            title.innerHTML = `<i class="codicon codicon-check" style="color: #4ade80;"></i> Hunt Complete - ${results.length} Live Keys Found!`;
            addLog(`<br><b style="color: #4ade80;">✅ Injected ${results.length} live key(s) into your environment.</b>`);
            for (const r of results) {
                addLog(`<span style="color: #4ade80;">  → ${r.type} from ${r.repo}</span>`);
            }
        } else {
            title.innerHTML = `<i class="codicon codicon-info"></i> Hunt Complete - No new keys.`;
            addLog(`<br>All discovered keys were dead or revoked. Try again later for fresh vectors.`);
        }
        // ALWAYS refresh models after hunt — picks up any newly injected keys
        const store = (window as any).useStore;
        if (store) {
            addLog(`<br><span style="opacity:0.6">Refreshing model list...</span>`);
            await store.getState().refreshAvailableModels();
            const models = store.getState().availableModels;
            if (models.length > 0) {
                addLog(`<b style="color: #60a5fa;">Found ${models.length} available model(s). Ready to chat!</b>`);
                // Auto-select the first model if none selected
                if (!store.getState().agentModel) {
                    const first = models[0];
                    const providerLabel = first.provider.charAt(0).toUpperCase() + first.provider.slice(1);
                    const formattedId = `${providerLabel}|${first.id}`;
                    store.getState().setAgentModel(formattedId);
                    addLog(`<span style="opacity:0.6">Auto-selected <b>${first.id}</b></span>`);
                }
            } else {
                addLog(`<span style="color: #f87171;">No models available. Even with keys, listing failed. Check your internet or keys.</span>`);
            }
        }
    } catch (err: any) {
        unlistenProgress();
        unlistenFound();
        const addLog = (msg: string) => {
            const logContent = document.getElementById("hunt-log-content");
            if (logContent) {
                const line = document.createElement("div");
                line.innerHTML = msg.replace(/\n/g, "<br>");
                logContent.appendChild(line);
                logContent.scrollTop = logContent.scrollHeight;
            }
        };
        addLog(`<br><span style="color: #f87171;">Error during hunt: ${err.message || err}</span>`);
        console.error("Hunt error:", err);
    }
}

(window as any).startKeyHunt = startKeyHunt;
