import { initTerminal } from './terminal.ts';
import { initExplorer, loadDirectory } from './explorer.ts';
import { sendAgentMessage, setupAgentUI } from './agent.ts';
import { initSettings } from './settings.ts';
import { initSpecs, refreshSpecs } from './specs.ts';
import { initStatusBar } from './status_bar.ts';
import { initMobile } from './mobile.ts';
import { initSearch } from './search.ts';
import { initGit, refreshGitStatus } from './git.ts';
import { initExtensions } from './extensions.ts';
import { setOnTabSwitch } from './workspace.ts';
import { loadFileContent, saveActiveFile } from './editor.ts';

declare const monaco: any;
declare const require: any;

import { invoke } from './tauri_bridge.ts';

const init = async () => {
    const explorerContent = document.getElementById("explorer-content");
    if (explorerContent) {
        initExplorer(explorerContent);
    }

    const runInit = (name: string, fn: () => any) => {
        try {
            console.log(`DEBUG: Initializing ${name}...`);
            fn();
            console.log(`DEBUG: ${name} initialized successfully.`);
        } catch (e) {
            console.error(`ERROR: ${name} initialization failed:`, e);
        }
    };

    runInit("Terminal", initTerminal);
    runInit("Settings", initSettings);
    runInit("Specs", initSpecs);
    runInit("StatusBar", initStatusBar);
    runInit("Mobile", initMobile);
    runInit("Search", initSearch);
    runInit("Git", initGit);
    runInit("Extensions", initExtensions);
    runInit("Agent UI", setupAgentUI);

    // Initialize extension host
    invoke("ext_host_init").catch((e: any) => console.error("Ext host init failed:", e));

    // Register tab switch handler
    setOnTabSwitch(loadFileContent);

    // Monaco Initialization
    if ((window as any).require) {
        (window as any).require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
        (window as any).require(['vs/editor/editor.main'], () => {
            (window as any).monacoEditor = monaco.editor.create(document.getElementById('editor'), {
                value: '',
                language: 'rust',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: true },
                lineNumbers: "on",
                roundedSelection: true,
                scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false,
                    verticalHasArrows: false,
                    horizontalHasArrows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                }
            });

            (window as any).monacoEditor.onDidChangeCursorPosition((e: any) => {
                const cursorPos = document.getElementById("cursor-pos");
                if (cursorPos) {
                    cursorPos.innerText = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                }
            });
        });
    }

    // Setup UI button listeners
    const handleOpenFolder = async () => {
        try {
            console.log("DEBUG: handleOpenFolder clicked");
            const selected = await invoke("open_folder");
            console.log("DEBUG: open_folder returned:", selected);
            if (selected) {
                await loadDirectory(selected as string);
                refreshSpecs();
                refreshGitStatus();
            }
        } catch (e) {
            console.error("Open folder failed:", e);
        }
    };

    const explorerOpenBtn = document.getElementById("explorer-open-folder");
    if (explorerOpenBtn) {
        explorerOpenBtn.onclick = handleOpenFolder;
    }

    const welcomeOpenBtn = document.getElementById("welcome-open-folder");
    if (welcomeOpenBtn) {
        welcomeOpenBtn.onclick = handleOpenFolder;
    }

    // Sidebar View Switching (Exposed globally)
    const switchSidebarViewInternal = (targetId: string) => {
        if (targetId === 'agent-view') {
            const rightSidebar = document.getElementById("right-sidebar");
            const rightResizer = document.getElementById("right-sidebar-resizer");
            const agentActivityBtn = Array.from(document.querySelectorAll(".activity-item")).find(i => i.getAttribute("data-target") === "agent-view") as HTMLElement | undefined;

            if (rightSidebar && rightResizer) {
                const isHidden = rightSidebar.style.display === "none";
                rightSidebar.style.display = isHidden ? "flex" : "none";
                rightResizer.style.display = isHidden ? "block" : "none";

                if (agentActivityBtn) {
                    if (isHidden) {
                        agentActivityBtn.classList.add("active-right");
                        agentActivityBtn.style.color = "#fff";
                    } else {
                        agentActivityBtn.classList.remove("active-right");
                        agentActivityBtn.style.color = "";
                    }
                }

                if (isHidden) {
                    setTimeout(() => {
                        const input = document.getElementById("agent-input");
                        if (input) input.focus();
                    }, 50);
                }
            }
            return;
        }

        const item = Array.from(document.querySelectorAll(".activity-item")).find(i => i.getAttribute("data-target") === targetId);
        if (!item) {
            // Fallback for simple ID matching if no activity item found
            const targetView = document.getElementById(targetId);
            if (targetView) {
                const views = document.querySelectorAll(".sidebar-section");
                views.forEach(v => v.classList.add("hidden"));
                targetView.classList.remove("hidden");
            }
            return;
        }

        // Update active state (only for left sidebar items)
        document.querySelectorAll(".activity-item").forEach(i => {
            if (i.getAttribute("data-target") !== "agent-view") {
                i.classList.remove("active");
            }
        });
        item.classList.add("active");

        // Show target view
        const views = document.querySelectorAll(".sidebar-section");
        views.forEach(v => v.classList.add("hidden"));
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.remove("hidden");

        // Update sidebar title
        const title = item.getAttribute("title");
        const sidebarTitle = document.getElementById("sidebar-title");
        if (sidebarTitle && title) sidebarTitle.innerText = title;
    };

    (window as any).switchSidebarView = (name: string) => {
        const mapping: Record<string, string> = {
            'agent': 'agent-view',
            'explorer': 'explorer-view',
            'search': 'search-view',
            'scm': 'scm-view',
            'debug': 'debug-view',
            'extensions': 'extensions-view',
            'specs': 'specs-view'
        };
        switchSidebarViewInternal(mapping[name] || name);
    };

    const activityItems = document.querySelectorAll(".activity-item");
    activityItems.forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            if (target) switchSidebarViewInternal(target);
        });
    });

    const closeAgentBtn = document.getElementById("close-agent-panel");
    if (closeAgentBtn) {
        closeAgentBtn.addEventListener("click", () => switchSidebarViewInternal("agent-view"));
    }

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

    console.log("DEBUG: main.ts initialization complete");

    // Global keyboard shortcuts
    const commandPalette = document.getElementById("command-palette");
    const commandInput = document.getElementById("command-input") as HTMLInputElement;

    const hideCommandPalette = () => {
        if (commandPalette) {
            commandPalette.classList.add("hidden");
        }
    };

    const toggleSidebar = () => {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            if (sidebar.style.display === "none") {
                sidebar.style.display = "flex";
            } else {
                sidebar.style.display = "none";
            }
        }
    };

    const commands = [
        { id: "workbench.action.files.openFolder", title: "File: Open Folder", run: handleOpenFolder },
        { id: "workbench.action.files.save", title: "File: Save", run: saveActiveFile },
        { id: "workbench.action.findInFiles", title: "Search: Find in Files", run: () => { switchSidebarViewInternal("search-view"); document.getElementById("search-input")?.focus(); } },
        { id: "workbench.view.extensions", title: "View: Show Extensions", run: () => switchSidebarViewInternal("extensions-view") },
        { id: "workbench.action.toggleSidebarVisibility", title: "View: Toggle Primary Side Bar Visibility", run: toggleSidebar },
        { id: "workbench.action.terminal.new", title: "Terminal: Create New Terminal", run: () => { document.getElementById("new-terminal")?.click(); } },
        { id: "workbench.action.quickOpen", title: "Go to File...", run: () => { switchSidebarViewInternal("explorer-view"); } }
    ];

    const renderCommands = (filter: string = "") => {
        const list = document.getElementById("command-list");
        if (!list) return;
        list.innerHTML = "";

        const filtered = commands.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));
        filtered.forEach(cmd => {
            const div = document.createElement("div");
            div.className = "command-item";
            div.style.padding = "6px 12px";
            div.style.cursor = "pointer";
            div.style.color = "var(--text-primary)";
            div.style.borderBottom = "1px solid var(--border-color)";
            div.innerText = cmd.title;

            div.onmouseenter = () => div.style.backgroundColor = "var(--selection-bg)";
            div.onmouseleave = () => div.style.backgroundColor = "transparent";

            div.onclick = () => {
                hideCommandPalette();
                cmd.run();
            };
            list.appendChild(div);
        });
    };

    const showCommandPalette = () => {
        if (commandPalette && commandInput) {
            commandPalette.classList.remove("hidden");
            commandInput.value = ">";
            renderCommands();
            commandInput.focus();
        }
    };

    // Attach to global window object so index.html onclick works
    (window as any).showCommandPalette = showCommandPalette;
    (window as any).hideCommandPalette = hideCommandPalette;

    if (commandInput) {
        commandInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                hideCommandPalette();
                const editor = (window as any).monacoEditor;
                if (editor) editor.focus();
            }
        });
        commandInput.addEventListener("blur", () => {
            // Delay hide to allow clicks on items
            setTimeout(hideCommandPalette, 150);
        });
        commandInput.addEventListener("input", (e) => {
            const val = (e.target as HTMLInputElement).value;
            const filter = val.startsWith(">") ? val.substring(1).trim() : val.trim();
            renderCommands(filter);
        });
    }

    // Global keyboard shortcuts
    window.addEventListener("keydown", (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        // Cmd+S: Save
        if (cmdOrCtrl && e.key === 's') {
            e.preventDefault();
            saveActiveFile();
        }

        // Cmd+Shift+P / F1: Command Palette
        if ((cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === "F1") {
            e.preventDefault();
            showCommandPalette();
        }

        // Cmd+P: Quick Open (we'll map it to Command Palette for now)
        if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            showCommandPalette();
        }

        // Cmd+B: Toggle Sidebar
        if (cmdOrCtrl && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleSidebar();
        }

        // Cmd+Shift+F: Global Search
        if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            const sidebar = document.getElementById("sidebar");
            if (sidebar && sidebar.style.display === "none") {
                sidebar.style.display = "flex";
            }
            switchSidebarViewInternal("search-view");
            const searchInput = document.getElementById("search-input");
            if (searchInput) searchInput.focus();
        }

        // Cmd+Shift+X: Extensions
        if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            const sidebar = document.getElementById("sidebar");
            if (sidebar && sidebar.style.display === "none") {
                sidebar.style.display = "flex";
            }
            switchSidebarViewInternal("extensions-view");
        }
    });

    // Panel Resizers Logic
    const initResizers = () => {
        const sidebarResizer = document.getElementById("sidebar-resizer");
        const sidebar = document.getElementById("sidebar");

        if (sidebarResizer && sidebar) {
            let isResizingSidebar = false;

            sidebarResizer.addEventListener("mousedown", () => {
                isResizingSidebar = true;
                document.body.style.cursor = "col-resize";
            });

            document.addEventListener("mousemove", (e) => {
                if (!isResizingSidebar) return;
                const newWidth = Math.min(Math.max(170, e.clientX), 600);
                sidebar.style.width = `${newWidth}px`;
                if ((window as any).monacoEditor) {
                    (window as any).monacoEditor.layout();
                }
            });

            document.addEventListener("mouseup", () => {
                if (isResizingSidebar) {
                    isResizingSidebar = false;
                    document.body.style.cursor = "default";
                }
            });
        }

        const panelResizer = document.getElementById("panel-resizer");
        const bottomPanel = document.getElementById("bottom-panel");

        if (panelResizer && bottomPanel) {
            let isResizingPanel = false;

            panelResizer.addEventListener("mousedown", () => {
                isResizingPanel = true;
                document.body.style.cursor = "row-resize";
            });

            document.addEventListener("mousemove", (e) => {
                if (!isResizingPanel) return;
                const containerHeight = document.body.clientHeight;
                const newHeight = containerHeight - e.clientY;
                const constrainedHeight = Math.min(Math.max(100, newHeight), containerHeight - 150);
                bottomPanel.style.height = `${constrainedHeight}px`;
                if ((window as any).monacoEditor) {
                    (window as any).monacoEditor.layout();
                }
            });

            document.addEventListener("mouseup", () => {
                if (isResizingPanel) {
                    isResizingPanel = false;
                    document.body.style.cursor = "default";
                    window.dispatchEvent(new Event('resize')); // triggers xterm fit
                }
            });
        }

        const rightResizer = document.getElementById("right-sidebar-resizer");
        const rightSidebar = document.getElementById("right-sidebar");

        if (rightResizer && rightSidebar) {
            let isResizingRight = false;

            rightResizer.addEventListener("mousedown", () => {
                isResizingRight = true;
                document.body.style.cursor = "col-resize";
            });

            document.addEventListener("mousemove", (e) => {
                if (!isResizingRight) return;
                const containerWidth = document.body.clientWidth;
                const newWidth = Math.min(Math.max(250, containerWidth - e.clientX), 800);
                rightSidebar.style.width = `${newWidth}px`;
                if ((window as any).monacoEditor) {
                    (window as any).monacoEditor.layout();
                }
            });

            document.addEventListener("mouseup", () => {
                if (isResizingRight) {
                    isResizingRight = false;
                    document.body.style.cursor = "default";
                }
            });
        }
    };

    initResizers();
};

// Start initialization
init();
