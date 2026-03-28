import { invoke } from './tauri_bridge';

export interface VscodeTheme {
    id: string;
    label: string;
    path: string;
    uiTheme: string;
    extensionName: string;
}

export async function getThemes(): Promise<VscodeTheme[]> {
    return await invoke<VscodeTheme[]>('get_installed_themes');
}

export async function applyTheme(themePath: string) {
    try {
        const themeJson = await invoke<any>('load_extension_theme', { path: themePath });
        const colors = themeJson.colors || {};
        
        // Map VS Code color keys to our CSS variables
        const root = document.documentElement;
        for (const [key, value] of Object.entries(colors)) {
            if (typeof value === 'string') {
                // Convert 'editor.background' to '--vscode-editor-background'
                const cssVar = `--vscode-${key.replace(/\./g, '-')}`;
                root.style.setProperty(cssVar, value);
            }
        }

        // Add some common fallbacks if missing
        if (!colors['sideBar.background'] && colors['editor.background']) {
            root.style.setProperty('--vscode-sideBar-background', colors['editor.background']);
        }
        if (!colors['sideBar.foreground'] && colors['editor.foreground']) {
            root.style.setProperty('--vscode-sideBar-foreground', colors['editor.foreground']);
        }

        const bg = colors['editor.background'] || '#1e1e1e';
        const isDark = isColorDark(bg);
        
        root.style.setProperty('--vscode-is-dark', isDark ? 'true' : 'false');
        
        // Persist theme choice
        localStorage.setItem('active-theme-path', themePath);
        
        return isDark ? 'vs-dark' : 'vs';
    } catch (e) {
        console.error("Failed to apply theme:", e);
        return 'vs-dark';
    }
}

function isColorDark(hex: string): boolean {
    if (!hex) return true;
    
    // Handle rgba or rgb
    if (hex.startsWith('rgb')) {
        const match = hex.match(/\d+/g);
        if (match && match.length >= 3) {
            const [r, g, b] = match.map(Number);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance < 0.5;
        }
        return true;
    }

    if (hex[0] !== '#') return true;
    
    // Simple hex parser
    let r, g, b;
    if (hex.length <= 5) { // #RGB or #RGBA
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else { // #RRGGBB or #RRGGBBAA
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}
