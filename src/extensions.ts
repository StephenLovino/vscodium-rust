import { invoke } from './tauri_bridge.ts';
import { open } from '@tauri-apps/plugin-dialog';

export function initExtensions() {
    console.log("DEBUG: initExtensions called");
    const searchInput = document.getElementById("extensions-search-input") as HTMLInputElement;
    const marketplaceList = document.getElementById("marketplace-extensions-list");
    const recommendedList = document.getElementById("recommended-extensions-list");
    const installedList = document.getElementById("installed-extensions-list");

    if (searchInput && marketplaceList) {
        searchInput.onkeydown = async (e) => {
            if (e.key === "Enter") {
                const query = searchInput.value.trim();
                console.log("DEBUG: Extension search query:", query);
                if (!query) return;

                marketplaceList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">Searching Marketplace...</div>';

                try {
                    const results = await invoke<any[]>("search_extensions", { query });
                    console.log("DEBUG: Marketplace results:", results);
                    renderMarketplace(results, marketplaceList);
                } catch (err) {
                    console.error("Marketplace search failed:", err);
                    marketplaceList.innerHTML = `<div style="padding: 10px; color: #f48771;">Search error: ${err}</div>`;
                }
            }
        };
    }

    const installedHeader = document.getElementById("installed-accordion-header");
    const recommendedHeader = document.getElementById("recommended-accordion-header");
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

    if (recommendedHeader && recommendedList) {
        recommendedHeader.onclick = () => {
            recommendedList.classList.toggle("collapsed");
            const icon = recommendedHeader.querySelector(".accordion-icon");
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
                    await invoke("install_vsix", { path: filePath });
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

        // Parse contributions for Activity Bar and Sidebars
        const contributions = {
            viewsContainers: { activitybar: [] as any[] },
            views: {} as Record<string, any[]>
        };

        extensions.forEach(ext => {
            if (ext.contributes) {
                const contrib = ext.contributes;
                
                // Activity Bar containers
                if (contrib.viewsContainers?.activitybar) {
                    contrib.viewsContainers.activitybar.forEach((container: any) => {
                        contributions.viewsContainers.activitybar.push({
                            ...container,
                            extensionPath: ext.extensionPath,
                            publisher: ext.publisher,
                            extensionName: ext.id
                        });
                    });
                }

                // Sidebar views
                if (contrib.views) {
                    Object.keys(contrib.views).forEach(location => {
                        if (!contributions.views[location]) contributions.views[location] = [];
                        contrib.views[location].forEach((view: any) => {
                           contributions.views[location].push({
                               ...view,
                               extensionPath: ext.extensionPath
                           });
                        });
                    });
                }
            }
        });

        (window as any).useStore.getState().setExtensionContributions(contributions);
    } catch (err) {
        console.error("Failed to get installed extensions or icon themes:", err);
    }

    // Load recommended/popular extensions
    const recommendedList = document.getElementById("recommended-extensions-list");
    if (recommendedList) {
        loadRecommendedExtensions(recommendedList);
    }

    const marketplaceList = document.getElementById("marketplace-extensions-list");
    if (marketplaceList) {
        // marketplaceList.innerHTML = '<div style="padding: 10px; opacity: 0.5;">Search to find more...</div>';
    }
}

async function loadRecommendedExtensions(container: HTMLElement) {
    try {
        const results = await invoke<any[]>("get_popular_extensions");
        renderMarketplace(results, container);
        const badge = document.getElementById("recommended-count-badge");
        if (badge) badge.innerText = results.length.toString();
    } catch (err) {
        console.error("Failed to load recommended extensions:", err);
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
        
        const icon = ext.iconUrl || ext.icon_url || "https://open-vsx.org/api/icons/default.png";
        const downloads = ext.downloadCount ? (ext.downloadCount > 1000 ? (ext.downloadCount / 1000).toFixed(1) + "k" : ext.downloadCount) : "0";
        const rating = ext.averageRating ? ext.averageRating.toFixed(1) : "0.0";

        item.innerHTML = `
            <div class="extension-icon-box">
                <img src="${icon}" onerror="this.src='https://open-vsx.org/api/icons/default.png'" />
            </div>
            <div class="extension-main">
                <div class="extension-header">
                    <div class="extension-name">${ext.displayName || ext.name}</div>
                    <div class="extension-version">v${ext.version}</div>
                </div>
                <div class="extension-publisher">${ext.publisher || ext.namespace}</div>
                <div class="extension-description">${ext.description || "No description provided."}</div>
                
                <div class="extension-footer">
                    <span class="extension-stat"><i class="codicon codicon-cloud-download"></i> ${downloads}</span>
                    <span class="extension-stat"><i class="codicon codicon-star-full" style="color: #f1c40f;"></i> ${rating}</span>
                </div>

                <button class="install-btn">Install</button>
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
                await invoke("install_extension", { 
                    publisher: ext.publisher || ext.namespace, 
                    name: ext.name, 
                    version: ext.version 
                });
                installBtn.innerText = "Installed";
                installBtn.disabled = true;
                installBtn.style.background = "transparent";
                installBtn.style.color = "var(--vscode-button-background)";
                installBtn.style.border = "1px solid var(--vscode-button-background)";
                
                // Proactively apply the extension effects
                await refreshInstalledExtensions();
                console.log("Extension applied automatically");
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
    const badge = document.getElementById("installed-count-badge");
    if (badge) badge.innerText = (extensions?.length || 0).toString();
    if (!extensions || extensions.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--vscode-sideBar-foreground); opacity: 0.5; font-size: 12px; text-align: center;">No extensions installed.</div>';
        return;
    }

    extensions.forEach(ext => {
        const item = document.createElement("div");
        item.className = "extension-item installed";
        
        const iconHtml = ext.base64_icon 
            ? `<img src="${ext.base64_icon}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />`
            : ``;
        const fallbackIcon = `<i class="codicon codicon-extensions" style="font-size: 32px; color: #007acc; ${ext.base64_icon ? 'display: none;' : ''}"></i>`;

        item.innerHTML = `
            <div class="extension-icon-box">
                ${iconHtml}
                ${fallbackIcon}
            </div>
            <div class="extension-main">
                <div class="extension-header">
                    <div class="extension-name">${ext.name}</div>
                    <div class="extension-version">v${ext.version}</div>
                </div>
                <div class="extension-publisher">${ext.publisher}</div>
                <div class="extension-description">${ext.description || ""}</div>
                <div class="extension-footer">
                     <i class="codicon codicon-settings" style="cursor: pointer;" title="Extension Settings"></i>
                     <i class="codicon codicon-debug-pause" style="cursor: pointer;" title="Disable Extension"></i>
                     <i class="codicon codicon-trash" style="cursor: pointer;" title="Uninstall"></i>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}
