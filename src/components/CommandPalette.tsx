import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';

interface Command {
    id: string;
    label: string;
    run: () => void;
}

const CommandPalette: React.FC = () => {
    const isOpen = useStore(state => state.isCommandPaletteOpen);
    const setOpen = useStore(state => state.setCommandPaletteOpen);
    const query = useStore(state => state.commandPaletteQuery);
    const setQuery = useStore(state => state.setCommandPaletteQuery);
    
    const [commands, setCommands] = useState<Command[]>([]);
    const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Get current commands from the global registry (exposed by commands.ts)
            const registry = (window as any).commandRegistry || [];
            setCommands(registry);
            setFilteredCommands(registry);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    useEffect(() => {
        const filtered = commands.filter(c => 
            c.label.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredCommands(filtered);
        setSelectedIndex(0);
    }, [query, commands]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = filteredCommands[selectedIndex];
            if (cmd) {
                setOpen(false);
                cmd.run();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div id="command-palette" className="command-palette">
            <div className="command-input-container">
                <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="Type a command or search..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className="command-list">
                {filteredCommands.map((cmd, idx) => (
                    <div 
                        key={cmd.id} 
                        className={`command-item ${idx === selectedIndex ? 'selected' : ''}`}
                        style={{
                            padding: '4px 10px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            backgroundColor: idx === selectedIndex ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                            color: idx === selectedIndex ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'
                        }}
                        onClick={() => {
                            setOpen(false);
                            cmd.run();
                        }}
                    >
                        {cmd.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CommandPalette;
