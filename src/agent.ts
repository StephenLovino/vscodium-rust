import { invoke } from './tauri_bridge.ts';
import { browserOpen, browserNavigate, browserScreenshot, browserClose } from './browser.ts';

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

let chatHistory: ChatMessage[] = [];

const providerModels: Record<string, string[]> = {
    "OpenAI": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    "Anthropic": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
    "Google": ["gemini-1.5-pro", "gemini-1.5-flash"],
    "Groq": ["llama3-8b-8192", "mixtral-8x7b-32768", "llama3-70b-8192"],
    "OpenRouter": ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3-70b-instruct"],
    "xAI": ["grok-beta"],
    "Cerebras": ["llama3.1-8b", "llama3.1-70b"]
};

let currentAgentProvider = "Google";
let currentAgentModel = "gemini-1.5-pro";
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

export function setupAgentUI() {
    const modeDropdown = document.getElementById("agent-mode-dropdown");
    const modeLabel = document.getElementById("agent-mode-label");

    if (modeDropdown) {
        modeDropdown.onclick = (e) => {
            const rect = modeDropdown.getBoundingClientRect();
            createPopover(rect.left, rect.top, [
                { label: "Planning", value: "Planning", desc: "Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work" },
                { label: "Fast", value: "Fast", desc: "Agent will execute tasks directly. Use for simple tasks that can be completed faster" }
            ], (val, label) => {
                currentAgentMode = val;
                if (modeLabel) modeLabel.innerText = label;
            });
        };
    }

    const modelDropdown = document.getElementById("agent-model-dropdown");
    const modelLabel = document.getElementById("agent-model-label");

    if (modelDropdown) {
        modelDropdown.onclick = (e) => {
            const rect = modelDropdown.getBoundingClientRect();
            const items: { label: string, value: string, desc?: string }[] = [];

            // Premium custom labels as requested
            items.push({ label: "Gemini 3.1 Pro (High) New", value: "Google|gemini-1.5-pro" });
            items.push({ label: "Gemini 3.1 Pro (Low) New", value: "Google|gemini-1.5-flash" });
            items.push({ label: "Claude Sonnet 4.6 (Thinking)", value: "Anthropic|claude-3-5-sonnet-20241022" });
            items.push({ label: "Claude Opus 4.6 (Thinking)", value: "Anthropic|claude-3-opus-20240229" });
            items.push({ label: "GPT-OSS 120B (Medium)", value: "OpenRouter|meta-llama/llama-3-70b-instruct" });

            // Append the rest of ApiRadar options
            Object.keys(providerModels).forEach(prov => {
                providerModels[prov].forEach(mod => {
                    // Don't add duplicates
                    if (!items.find(i => i.value === `${prov}|${mod}`)) {
                        items.push({ label: `${prov} - ${mod}`, value: `${prov}|${mod}` });
                    }
                });
            });

            createPopover(rect.left, rect.top, items, (val, label) => {
                const parts = val.split("|");
                currentAgentProvider = parts[0];
                currentAgentModel = parts[1];
                if (modelLabel) modelLabel.innerText = label;
            });
        };
    }

    const contextBtn = document.querySelector('.agent-input-toolbar .codicon-add')?.parentElement;
    if (contextBtn) {
        contextBtn.onclick = (e) => {
            const rect = contextBtn.getBoundingClientRect();
            createPopover(rect.left, rect.top, [
                { label: "Media", value: "media" },
                { label: "Mentions", value: "mentions" },
                { label: "Workflows", value: "workflows" }
            ], (val, label) => {
                // Future handling of adding context
                const input = document.getElementById("agent-input") as HTMLInputElement;
                if (input) {
                    input.value += ` [Context: ${label}] `;
                    input.focus();
                }
            });
        };
    }
}

export async function sendAgentMessage(userPrompt: string, onUpdate: (msg: string) => void): Promise<void> {
    chatHistory.push({ role: "user", content: userPrompt });

    let maxCycles = 5;
    let currentCycle = 0;
    let agentResponse = "";

    const provider = currentAgentProvider;
    const model = currentAgentModel;

    while (currentCycle < maxCycles) {
        onUpdate("Thinking...");

        try {
            const response = await invoke<string>("ai_chat", {
                prompt: userPrompt,
                provider: provider,
                model: model
            });

            if (!response) {
                onUpdate("Agent failed to respond.");
                break;
            }

            agentResponse = response;
            chatHistory.push({ role: "assistant", content: agentResponse });

            // Parse for tool calls
            const toolCall = parseToolCall(agentResponse);
            if (!toolCall) {
                onUpdate(agentResponse);
                break;
            }

            // Execute tool
            onUpdate(`Executing: ${toolCall.type}...`);
            const toolResult = await executeTool(toolCall);

            // Feed back to LLM
            chatHistory.push({ role: "system", content: `TOOL_RESULT: ${toolResult}` });
            userPrompt = `The tool ${toolCall.type} returned: ${toolResult}. Please continue.`;
            currentCycle++;
        } catch (e: any) {
            console.error("Agent chat failed:", e);
            if (e.toString().includes("401") || e.toString().includes("Incorrect API key")) {
                onUpdate(`⚠️ **Missing AI API Key**\n\nThe Antigravity Agent requires an OpenAI API key.\n\nTo configure it, either:\n1. Save your key in a \`.env\` file in this workspace as \`OPENAI_API_KEY=sk-...\`\n2. Export it in your system: \`export OPENAI_API_KEY="sk-..."\``);
            } else {
                onUpdate(`Error: ${e}`);
            }
            break;
        }
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
            case "READ_FILE":
                return await invoke("open_file", { path: tool.arg });
            case "CREATE_FILE":
                await invoke("create_file", { path: tool.arg });
                return `Successfully created file: ${tool.arg}`;
            case "CREATE_DIR":
                await invoke("create_dir", { path: tool.arg });
                return `Successfully created directory: ${tool.arg}`;
            default:
                return "Unknown tool";
        }
    } catch (e) {
        return `Tool Error: ${e}`;
    }
}
