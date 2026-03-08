import { invoke } from './tauri_bridge.ts';
import { openFile } from './editor.ts';

export interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    children?: FileEntry[];
}

let sidebarContent: HTMLElement | null = null;
let activeRoot: string | null = null;

export async function createFile(path: string) {
    await invoke("create_file", { path });
}

export async function createDirectory(path: string) {
    await invoke("create_directory", { path });
}

export async function renamePath(oldPath: string, newPath: string) {
    await invoke("rename_path", { oldPath, newPath });
}

export async function deletePath(path: string) {
    await invoke("delete_path", { path });
}

export async function refreshExplorer() {
    if (activeRoot) {
        await loadDirectory(activeRoot);
    }
}

export function initExplorer(contentElement: HTMLElement) {
    sidebarContent = contentElement;

    document.getElementById("explorer-refresh")?.addEventListener("click", () => refreshExplorer());

    document.getElementById("explorer-new-file")?.addEventListener("click", async () => {
        if (!activeRoot) return;
        const name = prompt("Enter file name:");
        if (name) {
            await createFile(`${activeRoot}/${name}`);
            await refreshExplorer();
        }
    });

    document.getElementById("explorer-new-folder")?.addEventListener("click", async () => {
        if (!activeRoot) return;
        const name = prompt("Enter folder name:");
        if (name) {
            await createDirectory(`${activeRoot}/${name}`);
            await refreshExplorer();
        }
    });
}

export async function loadDirectory(path: string, container: HTMLElement = sidebarContent!) {
    try {
        if (container === sidebarContent) {
            activeRoot = path;
            (window as any).activeRoot = path;
            const folderName = path.split('/').pop() || path.split('\\').pop();
            const headerText = document.getElementById('explorer-header-text');
            if (headerText) {
                headerText.innerHTML = `<i class="codicon codicon-chevron-down" style="margin-right: 4px;"></i> ${folderName?.toUpperCase()}`;
            }
            container.innerHTML = "";
        }
        const entries = await invoke<FileEntry[]>("list_directory", { path });
        renderExplorer(entries, container);
    } catch (e) {
        console.error("Failed to load directory:", e);
        container.innerHTML = `<div style="padding: 10px; color: red;">Failed to load: ${e}</div>`;
    }
}

function renderExplorer(entries: FileEntry[], container: HTMLElement) {
    const ul = document.createElement("ul");
    ul.className = "tree-list";
    ul.style.listStyle = "none";
    ul.style.paddingLeft = container === sidebarContent ? "0" : "12px";

    entries.sort((a, b) => {
        if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
        return a.is_dir ? -1 : 1;
    });

    entries.forEach(entry => {
        const li = document.createElement("li");
        li.className = "tree-item-container";
        li.style.display = "block";

        const rowDiv = document.createElement("div");
        rowDiv.className = "tree-item";
        rowDiv.style.padding = "3px 5px";
        rowDiv.style.cursor = "pointer";
        rowDiv.style.display = "flex";
        rowDiv.style.alignItems = "center";

        const fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'system-ui', sans-serif";

        if (entry.is_dir) {
            rowDiv.innerHTML = `<i class="codicon codicon-chevron-right tree-folder-arrow" style="font-size:14px; margin-right:2px; transition: transform 0.1s;"></i><i class="codicon codicon-folder" style="color: #dcb67a; margin-right:6px; font-size:14px;"></i><span style="font-size:13px; font-family: ${fontFamily}; letter-spacing: 0.2px;">${entry.name}</span>`;
        } else {
            let iconColor = entry.name.endsWith('.rs') ? '#dea584' : (entry.name.endsWith('.ts') ? '#3178c6' : (entry.name.endsWith('.html') || entry.name.endsWith('.htm') ? '#e34c26' : (entry.name.endsWith('.css') ? '#264de4' : '#519aba')));
            rowDiv.innerHTML = `<i class="codicon codicon-file" style="color: ${iconColor}; margin-left: 17px; margin-right: 6px; font-size:14px;"></i><span style="font-size:13px; font-family: ${fontFamily}; letter-spacing: 0.2px;">${entry.name}</span>`;
        }

        li.appendChild(rowDiv);

        if (entry.is_dir) {
            let expanded = false;
            let childContainer: HTMLDivElement | null = null;
            rowDiv.onclick = async (e) => {
                e.stopPropagation();
                expanded = !expanded;
                const arrow = rowDiv.querySelector(".tree-folder-arrow") as HTMLElement;
                if (expanded) {
                    arrow.classList.remove("codicon-chevron-right");
                    arrow.classList.add("codicon-chevron-down");
                } else {
                    arrow.classList.add("codicon-chevron-right");
                    arrow.classList.remove("codicon-chevron-down");
                }

                if (expanded) {
                    childContainer = document.createElement("div");
                    li.appendChild(childContainer);
                    await loadDirectory(entry.path, childContainer);
                } else if (childContainer) {
                    li.removeChild(childContainer);
                    childContainer = null;
                }
            };
        } else {
            rowDiv.onclick = (e) => {
                e.stopPropagation();
                openFile(entry.path, entry.name);
            };
        }

        ul.appendChild(li);
    });

    container.appendChild(ul);
}

// Simplified explorer.ts
