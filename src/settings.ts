const { invoke } = window.__TAURI__.core;
import { addTab } from './workspace.ts';

export async function openSettings() {
    try {
        const configPath = await invoke<string>("get_config_path");
        const content = await invoke<string>("open_file", { path: configPath });

        const welcomeView = document.getElementById("welcome-view");
        const editorView = document.getElementById("editor");
        if (welcomeView) welcomeView.classList.add("hidden");
        if (editorView) editorView.classList.remove("hidden");

        if ((window as any).monacoEditor) {
            (window as any).monacoEditor.setValue(content);
        }

        addTab(configPath, "settings.json");
    } catch (e) {
        console.error("Failed to open settings:", e);
    }
}

export function initSettings() {
    const settingsBtn = document.getElementById("activity-settings");
    if (settingsBtn) {
        settingsBtn.onclick = () => openSettings();
    }
}
