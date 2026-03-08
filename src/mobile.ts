import { invoke } from './tauri_bridge.ts';

export function initMobile() {
    const refreshBtn = document.getElementById("refresh-adb");
    if (refreshBtn) {
        refreshBtn.onclick = () => refreshDevices();
    }

    // Initial refresh
    refreshDevices();
}

export async function refreshDevices() {
    const listContainer = document.getElementById("device-list");
    const noDevicesMsg = document.getElementById("no-devices-msg");

    if (!listContainer) return;

    try {
        const devices = await invoke<string[]>("adb_list_devices");
        listContainer.innerHTML = "";

        if (devices && devices.length > 0) {
            if (noDevicesMsg) noDevicesMsg.classList.add("hidden");
            devices.forEach(deviceId => {
                const item = document.createElement("div");
                item.className = "spec-item"; // Reuse styling for consistency
                item.style.display = "flex";
                item.style.justifyContent = "space-between";
                item.style.alignItems = "center";

                item.innerHTML = `
                    <div>
                        <div class="spec-item-title">${deviceId}</div>
                        <div class="spec-item-path">Android Device</div>
                    </div>
                    <div class="device-actions">
                        <i class="codicon codicon-play" title="Install & Run" style="cursor: pointer; margin-right: 8px;"></i>
                        <i class="codicon codicon-terminal" title="Logcat" style="cursor: pointer;"></i>
                    </div>
                `;

                const playBtn = item.querySelector(".codicon-play") as HTMLElement;
                playBtn.onclick = (e) => {
                    e.stopPropagation();
                    runOnDevice(deviceId);
                };

                listContainer.appendChild(item);
            });
        } else {
            if (noDevicesMsg) noDevicesMsg.classList.remove("hidden");
        }
    } catch (e) {
        console.error("Failed to refresh ADB devices:", e);
    }
}

async function runOnDevice(deviceId: string) {
    // In a real scenario, we'd prompt for APK or use build artifacts
    // For now, let's assume we have a way to pick a target
    const apkPath = prompt("Enter path to APK:");
    if (!apkPath) return;

    const packageName = prompt("Enter package name (e.g. com.example.app):");
    if (!packageName) return;

    try {
        const result = await invoke<string>("adb_install_and_run", {
            device: deviceId,
            apkPath,
            packageName
        });
        alert(result);
    } catch (e) {
        alert(`Failed to run on device: ${e}`);
    }
}
