import { invoke } from './tauri_bridge.ts';
import { open } from '@tauri-apps/plugin-dialog';

export function initExtensions() {
    console.log("DEBUG: initExtensions called");
    const searchInput = document.getElementById("extensions-search-input") as HTMLInputElement;
    const marketplaceList = document.getElementById("marketplace-extensions-list");
    const installedList = document.getElementById("installed-extensions-list");

    if (searchInput && marketplaceList) {
        searchInput.onkeydown = async (e) => {
            if (e.key === "Enter") {
                const query = searchInput.value.trim();
                console.log("DEBUG: Extension search query:", query);
                if (!query) return;

                marketplaceList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">Searching Marketplace...</div>';

                try {
                    const results = await invoke<any>("search_marketplace", { query });
                    console.log("DEBUG: Marketplace results:", results);
                    renderMarketplace(results.results, marketplaceList);
                } catch (err) {
                    console.error("Marketplace search failed:", err);
                    marketplaceList.innerHTML = `<div style="padding: 10px; color: #f48771;">Search error: ${err}</div>`;
                }
            }
        };
    }

    const installedHeader = document.getElementById("installed-accordion-header");
    const marketplaceHeader = document.getElementById("marketplace-accordion-header");
    const marketplaceContent = document.getElementById("marketplace-extensions-list");

    if (installedHeader && installedList) {
        installedHeader.onclick = () => {
            installedList.classList.toggle("collapsed");
            const icon = installedHeader.querySelector(".accordion-icon");
            if (icon) {
                icon.classList.toggle("codicon-chevron-down");
                icon.classList.toggle("codicon-chevron-right");
            }
        };
    }

    if (marketplaceHeader && marketplaceContent) {
        marketplaceHeader.onclick = () => {
            marketplaceContent.classList.toggle("collapsed");
            const icon = marketplaceHeader.querySelector(".accordion-icon");
            if (icon) {
                icon.classList.toggle("codicon-chevron-down");
                icon.classList.toggle("codicon-chevron-right");
            }
        };
    }

    const installVsixBtn = document.getElementById("install-vsix-btn");
    if (installVsixBtn) {
        installVsixBtn.onclick = async () => {
            try {
                const selected = await open({
                    multiple: false,
                    filters: [{
                        name: 'VSIX Extension',
                        extensions: ['vsix']
                    }]
                });

                if (selected) {
                    const filePath = Array.isArray(selected) ? selected[0] : selected;
                    console.log("Installing VSIX from:", filePath);
                    await invoke("install_vsix", { filePath });
                    console.log("VSIX installed successfully");
                    refreshInstalledExtensions();
                }
            } catch (err) {
                console.error("Failed to install VSIX:", err);
            }
        };
    }

    refreshInstalledExtensions();
}

export async function refreshInstalledExtensions() {
    const installedList = document.getElementById("installed-extensions-list");
    if (!installedList) return;

    try {
        const extensions = await invoke<any[]>("get_running_extensions");
        renderInstalled(extensions, installedList);
    } catch (err) {
        console.error("Failed to get installed extensions:", err);
    }
}

function renderMarketplace(extensions: any[], container: HTMLElement) {
    container.innerHTML = "";
    if (!extensions || extensions.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">No extensions found in Marketplace.</div>';
        return;
    }

    extensions.forEach(ext => {
        const item = document.createElement("div");
        item.className = "extension-item";
        item.style.padding = "12px";
        item.style.display = "flex";
        item.style.gap = "12px";
        item.style.borderBottom = "1px solid var(--border-color)";
        item.style.transition = "background 0.2s";
        item.onmouseenter = () => item.style.background = "rgba(255,255,255,0.03)";
        item.onmouseleave = () => item.style.background = "transparent";

        const icon = ext.files?.icon || "https://open-vsx.org/api/icons/default.png";

        item.innerHTML = `
            <img src="${icon}" class="extension-icon" />
            <div class="extension-info">
                <div class="extension-name">${ext.displayName || ext.name}</div>
                <div class="extension-publisher">${ext.namespace}</div>
                <div class="extension-description">${ext.description || "No description provided."}</div>
                <div style="margin-top: 6px;">
                    <button class="extension-install-btn install-btn">Install</button>
                </div>
            </div>
        `;

        const installBtn = item.querySelector(".install-btn") as HTMLButtonElement;
        installBtn.onclick = async () => {
            installBtn.innerText = "Installing...";
            installBtn.disabled = true;
            try {
                const downloadUrl = ext.files.download;
                await invoke("install_extension", { downloadUrl, name: `${ext.namespace}.${ext.name}` });
                installBtn.innerText = "Installed";
                installBtn.style.background = "transparent";
                installBtn.style.border = "1px solid var(--accent-color)";
                installBtn.style.color = "var(--accent-color)";
                refreshInstalledExtensions();
            } catch (err) {
                console.error("Installation failed:", err);
                installBtn.innerText = "Error";
                installBtn.style.background = "#f44336";
                setTimeout(() => {
                    installBtn.innerText = "Install";
                    installBtn.style.background = "var(--accent-color)";
                    installBtn.disabled = false;
                }, 3000);
            }
        };

        container.appendChild(item);
    });
}

function renderInstalled(extensions: any[], container: HTMLElement) {
    container.innerHTML = "";
    if (!extensions || extensions.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px;">No extensions installed.</div>';
        return;
    }

    extensions.forEach(ext => {
        const item = document.createElement("div");
        item.className = "extension-item";

        item.innerHTML = `
            <div class="extension-icon" style="display: flex; align-items: center; justify-content: center;">
                <i class="codicon codicon-extensions" style="font-size: 24px; color: var(--accent-color);"></i>
            </div>
            <div class="extension-info">
                <div class="extension-name">${ext.name}</div>
                <div class="extension-publisher">Version: ${ext.version}</div>
            </div>
        `;
        container.appendChild(item);
    });
}
