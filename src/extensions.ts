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

        // Check for icon themes
        const iconThemeMapping = await invoke<any>("get_icon_theme_mapping");
        if (iconThemeMapping) {
            (window as any).useStore.getState().setIconThemeMapping(iconThemeMapping);
        }
    } catch (err) {
        console.error("Failed to get installed extensions or icon themes:", err);
    }
}

function renderMarketplace(extensions: any[], container: HTMLElement) {
    container.innerHTML = "";
    if (!extensions || extensions.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--vscode-sideBar-foreground); opacity: 0.5; font-size: 13px;">No extensions found in Marketplace.</div>';
        return;
    }

    extensions.forEach(ext => {
        const item = document.createElement("div");
        item.className = "extension-item";
        
        const icon = ext.files?.icon || "https://open-vsx.org/api/icons/default.png";
        const downloads = ext.downloadCount ? (ext.downloadCount > 1000 ? (ext.downloadCount / 1000).toFixed(1) + "k" : ext.downloadCount) : "0";
        const rating = ext.averageRating ? ext.averageRating.toFixed(1) : "0.0";

        item.innerHTML = `
            <div class="extension-item-main" style="display: flex; gap: 12px; padding: 10px 12px; cursor: pointer;">
                <img src="${icon}" style="width: 42px; height: 42px; flex-shrink: 0; border-radius: 4px;" onerror="this.src='https://open-vsx.org/api/icons/default.png'" />
                <div class="extension-info" style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
                        <div class="extension-name" style="font-weight: 600; font-size: 13px; color: var(--vscode-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ext.displayName || ext.name}</div>
                        <div class="extension-version" style="font-size: 11px; opacity: 0.6; flex-shrink: 0;">v${ext.version}</div>
                    </div>
                    <div class="extension-publisher" style="font-size: 11px; color: var(--vscode-sideBar-foreground); opacity: 0.7;">${ext.namespace}</div>
                    <div class="extension-description" style="font-size: 12px; margin-top: 2px; color: var(--vscode-sideBar-foreground); opacity: 0.8; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3;">${ext.description || "No description provided."}</div>
                    
                    <div class="extension-stats" style="display: flex; align-items: center; gap: 12px; margin-top: 6px; font-size: 11px; opacity: 0.6;">
                        <span style="display: flex; align-items: center; gap: 4px;"><i class="codicon codicon-cloud-download"></i> ${downloads}</span>
                        <span style="display: flex; align-items: center; gap: 4px;"><i class="codicon codicon-star-full" style="color: #f1c40f;"></i> ${rating}</span>
                    </div>

                    <div class="extension-actions" style="margin-top: 8px;">
                        <button class="install-btn" style="padding: 4px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; font-size: 12px; cursor: pointer; width: 100%; transition: background 0.1s;">Install</button>
                    </div>
                </div>
            </div>
        `;

        const installBtn = item.querySelector(".install-btn") as HTMLButtonElement;
        installBtn.onmouseenter = () => installBtn.style.background = 'var(--vscode-button-hoverBackground)';
        installBtn.onmouseleave = () => installBtn.style.background = 'var(--vscode-button-background)';
        
        installBtn.onclick = async (e) => {
            e.stopPropagation();
            const originalText = installBtn.innerText;
            installBtn.innerText = "Installing...";
            installBtn.disabled = true;
            installBtn.style.opacity = "0.7";
            try {
                const downloadUrl = ext.files.download;
                await invoke("install_extension", { downloadUrl, name: `${ext.namespace}.${ext.name}` });
                installBtn.innerText = "Installed";
                installBtn.disabled = true;
                installBtn.style.background = "transparent";
                installBtn.style.color = "var(--vscode-button-background)";
                installBtn.style.border = "1px solid var(--vscode-button-background)";
                refreshInstalledExtensions();
            } catch (err) {
                console.error("Installation failed:", err);
                installBtn.innerText = "Error";
                installBtn.style.background = "var(--vscode-errorForeground)";
                setTimeout(() => {
                    installBtn.innerText = originalText;
                    installBtn.style.background = "var(--vscode-button-background)";
                    installBtn.disabled = false;
                    installBtn.style.opacity = "1";
                }, 3000);
            }
        };

        container.appendChild(item);
    });
}

function renderInstalled(extensions: any[], container: HTMLElement) {
    container.innerHTML = "";
    if (!extensions || extensions.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--vscode-sideBar-foreground); opacity: 0.5; font-size: 12px; text-align: center;">No extensions installed.</div>';
        return;
    }

    extensions.forEach(ext => {
        const item = document.createElement("div");
        item.className = "extension-item installed";
        
        const iconHtml = ext.base64_icon 
            ? `<img src="${ext.base64_icon}" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 4px;" />`
            : `<i class="codicon codicon-extensions" style="font-size: 32px; color: var(--vscode-button-background);"></i>`;

        item.innerHTML = `
            <div style="display: flex; gap: 12px; padding: 8px 12px; cursor: pointer;">
                ${iconHtml}
                <div class="extension-info" style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                        <div class="extension-name" style="font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vscode-foreground);">${ext.name}</div>
                        <div class="extension-version" style="font-size: 11px; opacity: 0.6; flex-shrink: 0;">v${ext.version}</div>
                    </div>
                    <div class="extension-publisher" style="font-size: 11px; opacity: 0.7; color: var(--vscode-sideBar-foreground);">${ext.publisher}</div>
                    <div class="extension-description" style="font-size: 12px; margin-top: 2px; color: var(--vscode-sideBar-foreground); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ext.description || ""}</div>
                    <div class="extension-actions" style="margin-top: 6px; display: flex; gap: 12px; opacity: 0.6;">
                         <i class="codicon codicon-settings" style="font-size: 14px; cursor: pointer;" title="Extension Settings"></i>
                         <i class="codicon codicon-debug-pause" style="font-size: 14px; cursor: pointer;" title="Disable Extension"></i>
                         <i class="codicon codicon-trash" style="font-size: 14px; cursor: pointer;" title="Uninstall"></i>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}
