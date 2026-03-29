import { loader } from '@monaco-editor/react';
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
        const tokenColors = themeJson.tokenColors || [];
        
        // Map VS Code color keys to our CSS variables
        const root = document.documentElement;
        for (const [key, value] of Object.entries(colors)) {
            if (typeof value === 'string') {
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

        // Transform tokenColors to Monaco rules
        const rules: any[] = [];
        tokenColors.forEach((tc: any) => {
            if (!tc.settings) return;
            const scopes = Array.isArray(tc.scope) ? tc.scope : (tc.scope ? tc.scope.split(',') : []);
            scopes.forEach((scope: string) => {
                const rule: any = { token: scope.trim() };
                if (tc.settings.foreground) rule.foreground = tc.settings.foreground.replace('#', '');
                if (tc.settings.fontStyle) {
                    if (tc.settings.fontStyle.includes('italic')) rule.fontStyle = 'italic';
                    if (tc.settings.fontStyle.includes('bold')) rule.fontStyle = (rule.fontStyle || '') + ' bold';
                }
                rules.push(rule);
            });
        });

        // Map standard Monaco tokens if not covered (best effort mapping)
        const monacoThemeName = `vscode-theme-${themePath.replace(/[/\\:.]/g, '-')}`;
        
        loader.init().then(monaco => {
            monaco.editor.defineTheme(monacoThemeName as any, {
                base: isDark ? 'vs-dark' : 'vs',
                inherit: true,
                rules: rules,
                colors: colors
            });
        });
        
        // Persist theme choice
        localStorage.setItem('active-theme-path', themePath);
        localStorage.setItem('active-monaco-theme', monacoThemeName);
        
        return monacoThemeName;
    } catch (e) {
        console.error("Failed to apply theme:", e);
        return 'vs-dark';
    }
}

export async function initTheme() {
    const themePath = localStorage.getItem('active-theme-path');
    if (themePath) {
        return await applyTheme(themePath);
    }
    return 'vs-dark';
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
