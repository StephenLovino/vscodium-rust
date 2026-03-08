import { invoke, listen } from './tauri_bridge.ts';
import { Terminal } from '@xterm/xterm';

export class TerminalManager {
    terminals: Map<string, any>;
    activeId: string | null;
    container: HTMLElement | null;
    tabsContainer: HTMLElement | null;
    idCounter: number;

    constructor() {
        this.terminals = new Map();
        this.activeId = null;
        this.container = document.getElementById("terminal-container");
        this.tabsContainer = document.getElementById("terminal-tabs");
        this.idCounter = 1;

        const newBtn = document.getElementById("new-terminal");
        if (newBtn) {
            newBtn.onclick = () => this.createTerminal();
        }
    }

    async createTerminal(): Promise<void> {
        const id = `term-${this.idCounter++}`;
        const wrapper = document.createElement("div");
        wrapper.className = "terminal-wrapper" + (this.activeId ? " hidden" : "");
        wrapper.id = `wrapper-${id}`;
        if (this.container) this.container.appendChild(wrapper);

        const TerminalKlass = (window as any).Terminal;
        const FitAddonKlass = (window as any).FitAddon ? (window as any).FitAddon.FitAddon : null;

        if (!TerminalKlass) {
            console.error("Terminal class not found. xterm.js failed to load.");
            if (wrapper) wrapper.innerHTML = "<div style='color:red; padding:10px;'>Terminal load failed: xterm.js not found</div>";
            return;
        }

        const term = new TerminalKlass({
            theme: { background: "#1e1e1e", foreground: "#cccccc" },
            fontSize: 12,
            fontFamily: 'var(--font-code)',
            cursorBlink: true,
        });

        if (FitAddonKlass) {
            const fitAddon = new FitAddonKlass();
            term.loadAddon(fitAddon);
            this.terminals.set(id, { term, fitAddon, wrapper });
        } else {
            console.warn("FitAddon not found.");
            this.terminals.set(id, { term, fitAddon: null, wrapper });
        }

        term.open(wrapper);
        term.write("> Loading terminal backend...\r\n");

        if (this.terminals.get(id).fitAddon) {
            setTimeout(() => {
                this.terminals.get(id).fitAddon.fit();
            }, 100);
        }

        // Use imported invoke
        term.onData((data: string) => invoke("write_to_terminal", { termId: id, data }));
        term.onResize(({ cols, rows }: { cols: number, rows: number }) => invoke("resize_terminal", { termId: id, cols, rows }));

        this.createTab(id);

        try {
            await invoke("spawn_terminal", { termId: id });
        } catch (e) {
            console.error("Failed to spawn terminal:", e);
            term.write(`\r\n\x1b[31mError spawning terminal: ${e}\x1b[0m\r\n`);
        }
        this.switchTo(id);
    }

    createTab(id: string): void {
        const btn = document.createElement("button");
        btn.className = "terminal-tab-btn";
        btn.innerText = `zsh (${id.split('-')[1]})`;
        btn.onclick = () => this.switchTo(id);
        const newTermBtn = document.getElementById("new-terminal");
        if (this.tabsContainer && newTermBtn) {
            this.tabsContainer.insertBefore(btn, newTermBtn);
        }
    }

    switchTo(id: string): void {
        const t = this.terminals.get(id);
        if (!t) return;

        if (this.activeId) {
            const active = this.terminals.get(this.activeId);
            if (active) active.wrapper.classList.add("hidden");
        }
        this.activeId = id;
        t.wrapper.classList.remove("hidden");
        t.term.focus();
        if (t.fitAddon) t.fitAddon.fit();

        document.querySelectorAll(".terminal-tab-btn").forEach((btn: any) => {
            btn.classList.toggle("active", btn.innerText.includes(`(${id.split('-')[1]})` || id));
        });
    }

    handleData(termId: string, data: string): void {
        const t = this.terminals.get(termId);
        if (t) t.term.write(data);
    }
}

let terminalManager: TerminalManager;

export async function initTerminal(): Promise<void> {
    const terminalElement = document.getElementById("terminal-container");
    if (terminalElement) {
        terminalElement.innerHTML = "";
    }

    terminalManager = new TerminalManager();

    // Do not create terminal automatically on startup
    // await terminalManager.createTerminal();

    listen("terminal-data", (event: any) => {
        const { term_id, data } = event.payload;
        if (terminalManager) {
            terminalManager.handleData(term_id, data);
        }
    });

    window.addEventListener("resize", () => {
        if (terminalManager) {
            for (const [id, t] of terminalManager.terminals.entries()) {
                if (t.fitAddon) {
                    try { t.fitAddon.fit(); } catch (e) { }
                }
            }
        }
    });
}
