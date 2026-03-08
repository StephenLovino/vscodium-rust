import { initTerminal } from './terminal.ts';
import { initExplorer, loadDirectory } from './explorer.ts';
import { sendAgentMessage } from './agent.ts';
import { initSettings } from './settings.ts';
import { initSpecs, refreshSpecs } from './specs.ts';
import { initStatusBar } from './status_bar.ts';
import { initMobile } from './mobile.ts';

const { invoke } = window.__TAURI__.core;

window.addEventListener("DOMContentLoaded", () => {
    const explorerContent = document.getElementById("explorer-content");
    if (explorerContent) {
        initExplorer(explorerContent);
    }

    initTerminal();
    initSettings();
    initSpecs();
    initStatusBar();
    initMobile();

    // Setup UI button listeners
    const explorerOpenBtn = document.getElementById("explorer-open-folder");
    if (explorerOpenBtn) {
        explorerOpenBtn.onclick = async () => {
            try {
                const selected = await invoke("open_folder");
                if (selected) {
                    await loadDirectory(selected as string);
                    refreshSpecs();
                }
            } catch (e) {
                console.error("Open folder failed:", e);
            }
        };
    }

    // Sidebar View Switching
    const activityItems = document.querySelectorAll(".activity-item");
    activityItems.forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            if (!target) return;

            // Update active state
            activityItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            // Show target view
            const views = document.querySelectorAll(".sidebar-section");
            views.forEach(v => v.classList.add("hidden"));
            document.getElementById(target)?.classList.remove("hidden");

            // Update sidebar title
            const title = item.getAttribute("title");
            const sidebarTitle = document.getElementById("sidebar-title");
            if (sidebarTitle && title) sidebarTitle.innerText = title;
        });
    });

    // Agent Input Handler
    const agentInput = document.getElementById("agent-input") as HTMLInputElement;
    const agentSendBtn = document.getElementById("agent-send");
    const agentMessages = document.getElementById("agent-messages");

    if (agentInput && agentSendBtn && agentMessages) {
        const sendMessage = async () => {
            const prompt = agentInput.value.trim();
            if (!prompt) return;

            // Display user message
            const userMsg = document.createElement("div");
            userMsg.style.marginBottom = "10px";
            userMsg.innerHTML = `<b style="color: #519aba;">You:</b><br/>${prompt}`;
            agentMessages.appendChild(userMsg);
            agentInput.value = "";

            // Call agent via autonomous loop
            const assistantMsg = document.createElement("div");
            assistantMsg.style.marginBottom = "10px";
            assistantMsg.innerHTML = `<b style="color: #ffcc00;">Assistant:</b><br/><span class="agent-response-text">Thinking...</span>`;
            agentMessages.appendChild(assistantMsg);

            const responseText = assistantMsg.querySelector(".agent-response-text") as HTMLElement;

            await sendAgentMessage(prompt, (update) => {
                responseText.innerHTML = update.replace(/\n/g, '<br/>');
                agentMessages.scrollTop = agentMessages.scrollHeight;
            });
        };

        agentSendBtn.onclick = sendMessage;
        agentInput.onkeydown = (e) => {
            if (e.key === "Enter") sendMessage();
        };
    }
});
