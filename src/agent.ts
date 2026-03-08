const { invoke } = window.__TAURI__.core;
import { browserOpen, browserNavigate, browserScreenshot, browserClose } from './browser.ts';

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

let chatHistory: ChatMessage[] = [];

export async function sendAgentMessage(userPrompt: string, onUpdate: (msg: string) => void): Promise<void> {
    chatHistory.push({ role: "user", content: userPrompt });

    let maxCycles = 5;
    let currentCycle = 0;
    let agentResponse = "";

    while (currentCycle < maxCycles) {
        onUpdate("Thinking...");

        try {
            const response = await invoke<string>("ai_chat", {
                prompt: userPrompt,
                model: "openai/gpt-4o" // Using a stronger model for tool calling
            });

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
        } catch (e) {
            console.error("Agent chat failed:", e);
            onUpdate(`Error: ${e}`);
            break;
        }
    }
}

function parseToolCall(text: string) {
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
            default:
                return "Unknown tool";
        }
    } catch (e) {
        return `Tool Error: ${e}`;
    }
}
