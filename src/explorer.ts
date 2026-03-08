const { invoke } = window.__TAURI__.core;
import { addTab } from './workspace.ts';

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
    ul.style.paddingLeft = container === sidebarContent ? "0" : "15px";

    entries.forEach(entry => {
        const li = document.createElement("li");
        li.className = "tree-item";
        li.style.padding = "2px 5px";
        li.style.cursor = "pointer";
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.gap = "6px";

        if (entry.is_dir) {
            li.innerHTML = `<i class="codicon codicon-chevron-right tree-folder-arrow" style="font-size:14px; transition: transform 0.1s;"></i> <i class="codicon codicon-folder" style="color: #dcb67a;"></i> <span style="font-size:13px">${entry.name}</span>`;
        } else {
            let iconColor = entry.name.endsWith('.rs') ? '#dea584' : '#519aba';
            li.innerHTML = `<i class="codicon codicon-file" style="color: ${iconColor}; margin-left: 18px;"></i> <span style="font-size:13px">${entry.name}</span>`;
        }

        if (entry.is_dir) {
            let expanded = false;
            let childContainer: HTMLDivElement | null = null;
            li.onclick = async (e) => {
                e.stopPropagation();
                expanded = !expanded;
                const arrow = li.querySelector(".tree-folder-arrow") as HTMLElement;
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
            li.onclick = (e) => {
                e.stopPropagation();
                openFile(entry.path, entry.name);
            };
        }

        ul.appendChild(li);
    });

    container.appendChild(ul);
}

export async function openFile(path: string, name: string) {
    try {
        const welcomeView = document.getElementById("welcome-view");
        const editorView = document.getElementById("editor");
        if (welcomeView) welcomeView.classList.add("hidden");
        if (editorView) editorView.classList.remove("hidden");

        const content = await invoke<string>("open_file", { path });
        if ((window as any).monacoEditor) (window as any).monacoEditor.setValue(content);
        addTab(path, name);

        invoke("ext_host_send", {
            msg: JSON.stringify({
                type: "documentOpened",
                uri: path,
                content: content,
                languageId: path.endsWith(".rs") ? "rust" : "plaintext"
            })
        });

        invoke("set_context_key", { key: "activeBuffer", value: path });
        const langId = path.endsWith(".rs") ? "rust" : "plaintext";
        invoke("check_activation_event", { event: `onLanguage:${langId}` });
    } catch (e) {
        console.error("Failed to open file:", e);
    }
}
