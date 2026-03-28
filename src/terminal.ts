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

    async createTerminal(container: HTMLElement, shell?: string, theme?: any, providedId?: string): Promise<string> {
        const id = providedId || `term-${Date.now()}`;
        
        const term = new Terminal({
            theme: theme || { 
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
        
        // Use a small delay to ensure container is fully rendered and has dimensions
        setTimeout(() => {
            try { fitAddon.fit(); } catch (e) {}
        }, 50);

        const terminalData: TerminalData = { 
            id, 
            term, 
            fitAddon, 
            shell: shell || "" 
        };
        
        this.terminals.set(id, terminalData);
        this.activeId = id;

        term.onData((data: string) => invoke("write_to_terminal", { id, data }));
        term.onResize(({ cols, rows }: { cols: number, rows: number }) => 
            invoke("resize_terminal", { id, cols, rows })
        );

        try {
            await invoke("spawn_terminal", { id, shell: terminalData.shell });
            // Fit again after spawn to ensure correct size
            setTimeout(() => {
                try { fitAddon.fit(); } catch (e) {}
            }, 100);
        } catch (e) {
            term.write(`\r\n\x1b[31mError spawning terminal: ${e}\x1b[0m\r\n`);
        }

        return id;
    }

    async closeTerminal(id: string): Promise<void> {
        const t = this.terminals.get(id);
        if (t) {
            await invoke("close_terminal", { id });
            t.term.dispose();
            this.terminals.delete(id);
            if (this.activeId === id) this.activeId = null;
        }
    }

    async getAvailableShells(): Promise<string[]> {
        return await invoke<string[]>("get_available_shells");
    }

    handleData(termId: string, data: string): void {
        const t = this.terminals.get(termId);
        if (t) t.term.write(data);
    }
    
    resize(id: string) {
        const t = this.terminals.get(id);
        if (t) {
            try { 
                t.fitAddon.fit();
                const { cols, rows } = t.term;
                invoke("resize_terminal", { id, cols, rows });
            } catch (e) {}
        }
    }

    setTheme(id: string, theme: any) {
        const t = this.terminals.get(id);
        if (t) {
            t.term.options.theme = theme;
        }
    }
}

export const terminalManager = new TerminalManager();

let isInitialized = false;

export async function initTerminal(): Promise<void> {
    if (isInitialized) return;
    isInitialized = true;

    listen("terminal-data", (event: any) => {
        const { term_id, data } = event.payload;
        terminalManager.handleData(term_id, data);
    });

    window.addEventListener("resize", () => {
        for (const id of terminalManager.terminals.keys()) {
            terminalManager.resize(id);
        }
    });

    // Expose a global way to spawn/manage terminals for the TitleBar
    (window as any).spawnTerminal = () => {
        // Find the BottomPanel's create function or dispatch event
        // For simplicity in this shell, we'll dispatch a custom event
        window.dispatchEvent(new CustomEvent('terminal:create'));
    };
}
