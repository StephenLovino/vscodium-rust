import { invoke, listen } from './tauri_bridge.ts';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface TerminalData {
    id: string;
    term: Terminal;
    fitAddon: FitAddon;
    shell: string;
}

export class TerminalManager {
    terminals: Map<string, TerminalData>;
    activeId: string | null;
    idCounter: number;

    constructor() {
        this.terminals = new Map();
        this.activeId = null;
        this.idCounter = 1;
    }

    async createTerminal(container: HTMLElement, shell?: string): Promise<string> {
        const id = `term-${Date.now()}`;
        
        const term = new Terminal({
            theme: { 
                background: "#1e1e1e", 
                foreground: "#cccccc",
                cursor: "#cccccc",
                selectionBackground: "rgba(255, 255, 255, 0.1)"
            },
            fontSize: 12,
            fontFamily: 'var(--font-mono, monospace)',
            cursorBlink: true,
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        term.open(container);
        fitAddon.fit();

        const terminalData: TerminalData = { 
            id, 
            term, 
            fitAddon, 
            shell: shell || (window.navigator.platform.includes('Win') ? 'powershell' : 'zsh') 
        };
        
        this.terminals.set(id, terminalData);
        this.activeId = id;

        term.onData((data: string) => invoke("write_to_terminal", { id, data }));
        term.onResize(({ cols, rows }: { cols: number, rows: number }) => 
            invoke("resize_terminal", { id, cols, rows })
        );

        try {
            await invoke("spawn_terminal", { id, shell: terminalData.shell });
        } catch (e) {
            term.write(`\r\n\x1b[31mError spawning terminal: ${e}\x1b[0m\r\n`);
        }

        return id;
    }

    async closeTerminal(id: string): Promise<void> {
        const t = this.terminals.get(id);
        if (t) {
            t.term.dispose();
            this.terminals.delete(id);
            if (this.activeId === id) this.activeId = null;
        }
    }

    handleData(termId: string, data: string): void {
        const t = this.terminals.get(termId);
        if (t) t.term.write(data);
    }
    
    resize(id: string) {
        const t = this.terminals.get(id);
        if (t) {
            try { t.fitAddon.fit(); } catch (e) {}
        }
    }
}

export const terminalManager = new TerminalManager();

export async function initTerminal(): Promise<void> {
    listen("terminal-data", (event: any) => {
        const { term_id, data } = event.payload;
        terminalManager.handleData(term_id, data);
    });

    window.addEventListener("resize", () => {
        for (const id of terminalManager.terminals.keys()) {
            terminalManager.resize(id);
        }
    });
}
