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

        // Provide generic ambient fallbacks if xterm script is loaded globally
        const TerminalKlass = (window as any).Terminal;
        const term = new TerminalKlass({
            theme: { background: "#1e1e1e", foreground: "#cccccc" },
            fontSize: 12,
            fontFamily: 'var(--font-code)',
            cursorBlink: true,
        });

        const FitAddonKlass = (window as any).FitAddon.FitAddon;
        const fitAddon = new FitAddonKlass();
        term.loadAddon(fitAddon);
        term.open(wrapper);
        term.write("> Loading terminal backend...\r\n");

        setTimeout(() => {
            fitAddon.fit();
        }, 100);

        const invoke = window.__TAURI__.core.invoke;
        term.onData((data: string) => invoke("write_to_terminal", { term_id: id, data }));
        term.onResize(({ cols, rows }: { cols: number, rows: number }) => invoke("resize_terminal", { term_id: id, cols, rows }));

        this.terminals.set(id, { term, fitAddon, wrapper });
        this.createTab(id);

        await invoke("spawn_terminal", { term_id: id });
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
        if (this.activeId) {
            this.terminals.get(this.activeId).wrapper.classList.add("hidden");
        }
        this.activeId = id;
        this.terminals.get(id).wrapper.classList.remove("hidden");
        this.terminals.get(id).term.focus();
        this.terminals.get(id).fitAddon.fit();

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
    await terminalManager.createTerminal();

    window.__TAURI__.event.listen("terminal-data", (event: any) => {
        const { term_id, data } = event.payload;
        terminalManager.handleData(term_id, data);
    });
}
