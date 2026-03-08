import { invoke } from './tauri_bridge.ts';
import { openFile } from './editor.ts';

export function initSearch() {
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    const searchResults = document.getElementById("search-results");

    if (searchInput && searchResults) {
        searchInput.onkeydown = async (e) => {
            if (e.key === "Enter") {
                const query = searchInput.value.trim();
                if (!query) return;

                searchResults.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">Searching...</div>';

                try {
                    const results = await invoke<any[]>("search_project", { query });
                    renderSearchResults(results, searchResults);
                } catch (err) {
                    console.error("Search failed:", err);
                    searchResults.innerHTML = `<div style="padding: 10px; color: #f48771;">Search error: ${err}</div>`;
                }
            }
        };
    }
}

function renderSearchResults(results: any[], container: HTMLElement) {
    if (results.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">No results found.</div>';
        return;
    }

    container.innerHTML = "";

    // Group by file
    const grouped: { [key: string]: any[] } = {};
    results.forEach(res => {
        if (!grouped[res.path]) grouped[res.path] = [];
        grouped[res.path].push(res);
    });

    for (const [path, matches] of Object.entries(grouped)) {
        const fileHeader = document.createElement("div");
        fileHeader.className = "search-file-header";
        fileHeader.style.padding = "4px 8px";
        fileHeader.style.cursor = "pointer";
        fileHeader.style.display = "flex";
        fileHeader.style.alignItems = "center";
        fileHeader.style.gap = "6px";
        fileHeader.style.backgroundColor = "rgba(255,255,255,0.03)";

        const fileName = path.split('/').pop() || path;
        fileHeader.innerHTML = `
            <i class="codicon codicon-chevron-down"></i>
            <i class="codicon codicon-file" style="color: #519aba;"></i>
            <span style="font-size: 13px; font-weight: 500;">${fileName}</span>
            <span style="font-size: 11px; color: var(--text-secondary); margin-left: auto;">${matches.length}</span>
        `;

        const matchesContainer = document.createElement("div");
        matchesContainer.className = "search-matches";

        matches.forEach(match => {
            const item = document.createElement("div");
            item.className = "search-match-item";
            item.style.padding = "2px 24px";
            item.style.fontSize = "12px";
            item.style.cursor = "pointer";
            item.style.whiteSpace = "nowrap";
            item.style.overflow = "hidden";
            item.style.textOverflow = "ellipsis";

            item.innerHTML = `
                <span style="color: var(--text-secondary); margin-right: 8px;">${match.line}</span>
                <span>${match.content.replace(match.query, `<span style="background: rgba(234, 184, 118, 0.4); color: #fff;">${match.query}</span>`)}</span>
            `;

            item.onclick = () => openFile(path, fileName);
            matchesContainer.appendChild(item);
        });

        fileHeader.onclick = () => {
            const isHidden = matchesContainer.style.display === "none";
            matchesContainer.style.display = isHidden ? "block" : "none";
            const arrow = fileHeader.querySelector(".codicon-chevron-down, .codicon-chevron-right") as HTMLElement;
            arrow.className = isHidden ? "codicon codicon-chevron-down" : "codicon codicon-chevron-right";
        };

        container.appendChild(fileHeader);
        container.appendChild(matchesContainer);
    }
}
