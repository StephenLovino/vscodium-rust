use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty};
use std::io::Write;
use tauri::State;
use ropey::Rope;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tree_sitter::{Parser, Query, QueryCursor, StreamingIterator};
use tree_sitter_rust::LANGUAGE;
use std::fs;
use std::path::PathBuf;

pub mod ai_engine;
use ai_engine::{AiEngine, AiRequest, ChatMessage};
mod ai_tools;
pub mod domain;
pub mod editor_service;
mod mcp_client;
mod mcp_registry;
pub mod repository;

mod lsp;
use lsp::LspClient;

mod context_key;
use context_key::{ContextKeyRegistry, ContextValue};

mod extension_host;
use extension_host::ExtensionHostManager;

mod git;
use git::GitManager;

mod performance;
use performance::{PerformanceMonitor, ProcessStats};

mod keybindings;
use keybindings::KeybindingRegistry;

mod debug_adapter;
use debug_adapter::DebugManager;

mod activation;
use activation::ActivationManager;

mod browser;
use browser::BrowserState;

#[derive(Serialize, Deserialize, Clone)]
struct Settings {
    theme: String,
    font_size: u32,
}

struct EditorState {
    buffers: Mutex<HashMap<String, Rope>>,
    active_path: Mutex<Option<String>>,
    settings: Mutex<Settings>,
    terminal_masters: Mutex<HashMap<String, Box<dyn MasterPty + Send>>>,
    #[allow(dead_code)]
    terminal_writers: Mutex<HashMap<String, Box<dyn Write + Send>>>,
    lsp_client: Arc<Mutex<LspClient>>,
    context_keys: Arc<ContextKeyRegistry>,
    ext_host: Arc<Mutex<ExtensionHostManager>>,
    keybindings: Arc<Mutex<KeybindingRegistry>>,
    debug_manager: Arc<Mutex<DebugManager>>,
    activation_manager: Arc<Mutex<ActivationManager>>,
    perf_monitor: Arc<PerformanceMonitor>,
    _ai_engine: Arc<tokio::sync::Mutex<AiEngine>>,
    #[allow(dead_code)]
    browser_state: Arc<BrowserState>,
    config_dir: PathBuf,
    _active_root: Mutex<Option<PathBuf>>,
    current_model: Mutex<String>,
    active_device: Mutex<Option<String>>,
    editor_tx: futures::channel::mpsc::UnboundedSender<domain::EditorCommand>,
}

#[derive(Serialize, Deserialize)]
struct Highlight {
    start: usize,
    end: usize,
    kind: String,
}

// Use domain::FileEntry
use domain::FileEntry;

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        
        if name.starts_with(".") {
            continue;
        }

        result.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            children: None,
        });
    }

    result.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(result)
}

#[tauri::command]
fn open_file(state: State<'_, EditorState>, path: String) -> Result<String, String> {
    let mut buffers = state.buffers.lock().unwrap();
    let mut active = state.active_path.lock().unwrap();
    
    if let Some(rope) = buffers.get(&path) {
        *active = Some(path.clone());
        return Ok(rope.to_string());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    buffers.insert(path.clone(), Rope::from_str(&content));
    *active = Some(path);

    Ok(content)
}

#[tauri::command]
async fn open_folder(app: tauri::AppHandle, state: State<'_, EditorState>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder);
    });
    
    let folder_path = rx.await.map_err(|e| e.to_string())?;
    
    if let Some(folder) = folder_path {
        let path = match folder {
            tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
            tauri_plugin_dialog::FilePath::Url(u) => u.path().to_string(),
        };
        
        // Auto-open as project
        let (e_tx, e_rx) = futures::channel::oneshot::channel();
        state.editor_tx.unbounded_send(domain::EditorCommand::OpenProject(PathBuf::from(&path), e_tx))
            .map_err(|e| format!("Failed to send Editor command: {}", e))?;
        e_rx.await.map_err(|e| format!("Editor command canceled: {}", e))??;
        
        return Ok(Some(path));
    }
    
    Ok(None)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

#[tauri::command]
fn switch_to_buffer(state: State<'_, EditorState>, path: String) -> Result<String, String> {
    let buffers = state.buffers.lock().unwrap();
    let mut active = state.active_path.lock().unwrap();
    
    if let Some(rope) = buffers.get(&path) {
        *active = Some(path);
        Ok(rope.to_string())
    } else {
        Err("Buffer not found".to_string())
    }
}

#[tauri::command]
fn save_file(state: State<'_, EditorState>, content: String) -> Result<(), String> {
    let active = state.active_path.lock().unwrap();
    let path = active.as_ref().ok_or("No active file")?;

    std::fs::write(path, &content)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    let mut buffers = state.buffers.lock().unwrap();
    buffers.insert(path.clone(), Rope::from_str(&content));

    Ok(())
}


#[allow(dead_code)]
fn create_file(path: String) -> Result<(), String> {
    if fs::metadata(&path).is_ok() {
        return Err("File already exists".to_string());
    }
    fs::File::create(path).map(|_| ()).map_err(|e| e.to_string())
}

#[allow(dead_code)]
fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_config_path(state: State<'_, EditorState>) -> Result<String, String> {
    Ok(state.config_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn set_ai_model(state: State<'_, EditorState>, model: String) -> Result<(), String> {
    let mut current = state.current_model.lock().unwrap();
    *current = model;
    Ok(())
}

#[tauri::command]
fn adb_list_devices() -> Result<Vec<String>, String> {
    let output = std::process::Command::new("adb").arg("devices").output()
        .map_err(|e| format!("ADB error: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();
    for line in stdout.lines().skip(1) {
        if line.is_empty() { continue; }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[1] == "device" {
            devices.push(parts[0].to_string());
        }
    }
    Ok(devices)
}

#[tauri::command]
fn set_active_device(state: State<'_, EditorState>, device: String) -> Result<(), String> {
    let mut active = state.active_device.lock().unwrap();
    *active = Some(device);
    Ok(())
}

#[tauri::command]
fn adb_install_and_run(device: String, apk_path: String, package_name: String) -> Result<String, String> {
    let install_output = std::process::Command::new("adb").args(["-s", &device, "install", "-r", &apk_path]).output()
        .map_err(|e| format!("ADB Install error: {}", e))?;
    if !install_output.status.success() {
        return Err(format!("Install failed: {}", String::from_utf8_lossy(&install_output.stderr)));
    }
    let run_output = std::process::Command::new("adb").args(["-s", &device, "shell", "monkey", "-p", &package_name, "-c", "android.intent.category.LAUNCHER", "1"]).output()
        .map_err(|e| format!("ADB Run error: {}", e))?;
    if !run_output.status.success() {
        return Err(format!("Run failed: {}", String::from_utf8_lossy(&run_output.stderr)));
    }
    Ok("Successfully installed and launched app".to_string())
}

#[tauri::command]
fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(old_path, new_path).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(())
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        std::fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn sync_content(state: State<'_, EditorState>, content: String) {
    let active = state.active_path.lock().unwrap();
    if let Some(path) = active.as_ref() {
        let mut buffers = state.buffers.lock().unwrap();
        buffers.insert(path.clone(), Rope::from_str(&content));
    }
}

#[derive(Serialize, Deserialize)]
struct SearchResult {
    path: String,
    line: usize,
    content: String,
}

#[tauri::command]
fn get_git_branch() -> Result<String, String> {
    let output = std::process::Command::new("git").args(["rev-parse", "--abbrev-ref", "HEAD"]).output()
        .map_err(|_| "Git not found".to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not a git repository".to_string())
    }
}

#[tauri::command]
fn git_status(path: String) -> Result<Vec<git::GitFileStatus>, String> {
    let manager = GitManager::new();
    manager.get_status(path)
}

#[tauri::command]
fn git_stage(path: String, file_path: String) -> Result<(), String> {
    let manager = GitManager::new();
    manager.stage(path, &file_path)
}

#[tauri::command]
fn git_unstage(path: String, file_path: String) -> Result<(), String> {
    let manager = GitManager::new();
    manager.unstage(path, &file_path)
}

#[tauri::command]
fn git_commit(path: String, message: String) -> Result<(), String> {
    let manager = GitManager::new();
    manager.commit(path, &message)
}

#[tauri::command]
fn get_process_stats(state: State<'_, EditorState>) -> Result<ProcessStats, String> {
    state.perf_monitor.get_stats().ok_or("Failed to get process stats".to_string())
}

#[tauri::command]
fn search_project(query: String) -> Result<Vec<SearchResult>, String> {
    use walkdir::WalkDir;
    let mut results = Vec::new();
    for entry in WalkDir::new(".").into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();
            if let Ok(content) = std::fs::read_to_string(path) {
                for (i, line) in content.lines().enumerate() {
                    if line.contains(&query) {
                        results.push(SearchResult {
                            path: path.to_string_lossy().to_string(),
                            line: i + 1,
                            content: line.trim().to_string(),
                        });
                    }
                }
            }
        }
        if results.len() > 1000 { break; }
    }
    Ok(results)
}

#[tauri::command]
fn get_highlights(state: State<'_, EditorState>) -> Vec<Highlight> {
    let active = state.active_path.lock().unwrap();
    let path = match active.as_ref() {
        Some(p) => p,
        None => return Vec::new(),
    };

    let buffers = state.buffers.lock().unwrap();
    let buffer = match buffers.get(path) {
        Some(b) => b,
        None => return Vec::new(),
    };
    
    let code = buffer.to_string();
    let mut parser = Parser::new();
    let lang: tree_sitter::Language = LANGUAGE.into();
    parser.set_language(&lang).expect("Error loading Rust grammar");
    
    let tree = parser.parse(&code, None).unwrap();
    let query_str = "(keyword) @keyword (function_item name: (identifier) @function)";
    let query = Query::new(&lang, query_str).unwrap();
    let mut cursor = QueryCursor::new();
    
    let mut highlights = Vec::new();
    let mut matches = cursor.matches(&query, tree.root_node(), code.as_bytes());
    while let Some(m) = matches.next() {
        for cap in m.captures {
            let kind = query.capture_names()[cap.index as usize].to_string();
            highlights.push(Highlight {
                start: cap.node.start_byte(),
                end: cap.node.end_byte(),
                kind,
            });
        }
    }
    highlights
}

#[tauri::command]
fn get_settings(state: State<'_, EditorState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn update_settings(state: State<'_, EditorState>, new_settings: Settings) -> Result<(), String> {
    let mut settings = state.settings.lock().unwrap();
    *settings = new_settings;
    let config_dir = state.config_dir.clone();
    let settings_path = config_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&*settings).unwrap();
    std::fs::write(settings_path, content).map_err(|e| format!("Failed to save settings: {}", e))?;
    Ok(())
}

#[tauri::command]
fn spawn_terminal(state: State<'_, EditorState>, id: String) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;
    
    let cmd = CommandBuilder::new(if cfg!(target_os = "windows") { "powershell" } else { "sh" });
    pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    
    let mut masters = state.terminal_masters.lock().unwrap();
    masters.insert(id.clone(), pair.master);
    Ok(())
}

#[tauri::command]
fn write_to_terminal(state: State<'_, EditorState>, id: String, data: String) -> Result<(), String> {
    let mut masters = state.terminal_masters.lock().unwrap();
    if let Some(_master) = masters.get_mut(&id) {
        // FIXME: Portable-pty 0.8.1 Box<dyn MasterPty> doesn't implement Write directly.
        // Needs a custom trait or version update. Working around for now as Zed bridge is priority.
        println!("Terminal write requested for {}: {}", id, data);
        Ok(())
    } else {
        Err("Terminal not found".to_string())
    }
}

#[tauri::command]
fn resize_terminal(state: State<'_, EditorState>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let mut masters = state.terminal_masters.lock().unwrap();
    if let Some(master) = masters.get_mut(&id) {
        master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal not found".to_string())
    }
}

#[tauri::command]
fn lsp_start(state: State<'_, EditorState>, app: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut lsp = state.lsp_client.lock().unwrap();
    lsp.start(&path, app).map_err(|e| e.to_string())
}

#[tauri::command]
fn lsp_stop(state: State<'_, EditorState>) -> Result<(), String> {
    let mut lsp = state.lsp_client.lock().unwrap();
    lsp.stop();
    Ok(())
}

#[tauri::command]
fn lsp_send_request(state: State<'_, EditorState>, method: String, params: Value) -> Result<(), String> {
    let mut lsp = state.lsp_client.lock().unwrap();
    lsp.send_request(1, &method, params).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_context_key(state: State<'_, EditorState>, key: String, value: ContextValue) {
    state.context_keys.set(key, value);
}

#[tauri::command]
fn evaluate_when_clause(state: State<'_, EditorState>, clause: String) -> bool {
    state.context_keys.evaluate(&clause)
}

#[tauri::command]
async fn ai_chat(state: State<'_, EditorState>, prompt: String) -> Result<String, String> {
    let ai = state._ai_engine.lock().await;
    
    let req = AiRequest {
        provider: "openai".to_string(),
        model: "gpt-4o".to_string(),
        messages: vec![ChatMessage { 
            role: "user".to_string(), 
            content: prompt,
            tool_calls: None,
        }],
        temperature: Some(0.7),
    };
    ai.send_prompt(req).await
}

#[tauri::command]
async fn register_ida_pro(state: State<'_, EditorState>, python_path: String, script_path: String) -> Result<(), String> {
    let ai = state._ai_engine.lock().await;
    ai.register_ida_pro_mcp(&python_path, &script_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_keybinding(state: State<'_, EditorState>, key: String) -> Option<String> {
    let registry = state.keybindings.lock().unwrap();
    registry.resolve_key(&key, &state.context_keys)
}

#[tauri::command]
fn ext_host_init(state: State<'_, EditorState>, app: tauri::AppHandle) -> Result<(), String> {
    let mut host = state.ext_host.lock().unwrap();
    host.start(app).map_err(|e| e.to_string())
}

#[tauri::command]
fn ext_host_send(state: State<'_, EditorState>, msg: String) -> Result<(), String> {
    let mut host = state.ext_host.lock().unwrap();
    host.send_message(msg).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_marketplace(_query: String) -> Result<Value, String> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
fn install_extension(_id: String) -> Result<(), String> { Ok(()) }

#[tauri::command]
fn install_vsix(_path: String) -> Result<(), String> { Ok(()) }

#[tauri::command]
fn get_running_extensions(_state: State<'_, EditorState>) -> Vec<String> { vec![] }

#[tauri::command]
fn debug_start(state: State<'_, EditorState>, app: tauri::AppHandle, adapter_path: String) -> Result<(), String> {
    let mut debug = state.debug_manager.lock().unwrap();
    debug.start_session(&adapter_path, app).map_err(|e| e.to_string())
}

#[tauri::command]
fn debug_send(state: State<'_, EditorState>, msg: String) -> Result<(), String> {
    let mut debug = state.debug_manager.lock().unwrap();
    debug.send_message(msg).map_err(|e| e.to_string())
}

#[tauri::command]
fn debug_stop(state: State<'_, EditorState>) -> Result<(), String> {
    let mut debug = state.debug_manager.lock().unwrap();
    debug.stop_session().map_err(|e| e.to_string())
}

#[tauri::command]
fn check_activation_event(state: State<'_, EditorState>, event: String) {
    let mut am = state.activation_manager.lock().unwrap();
    am.check_activation_requests(&event, state.ext_host.clone());
}

#[tauri::command]
async fn get_file_tree(
    state: tauri::State<'_, EditorState>,
) -> Result<Vec<FileEntry>, String> {
    let (tx, rx) = futures::channel::oneshot::channel();
    state.editor_tx.unbounded_send(domain::EditorCommand::GetFileTree(tx)).map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn backend_ping(state: tauri::State<'_, EditorState>) -> Result<String, String> {
    let (tx, rx) = futures::channel::oneshot::channel();
    state.editor_tx.unbounded_send(domain::EditorCommand::Ping(tx))
        .map_err(|e: futures::channel::mpsc::TrySendError<domain::EditorCommand>| e.to_string())?;
    let reply = rx.await.map_err(|e: futures::channel::oneshot::Canceled| e.to_string())?;
    Ok(reply)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(editor_tx: futures::channel::mpsc::UnboundedSender<domain::EditorCommand>) {
    let config_dir = std::env::current_dir().unwrap().join("config");
    if !config_dir.exists() { fs::create_dir_all(&config_dir).ok(); }
    let settings_path = config_dir.join("settings.json");
    let initial_settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(Settings { theme: "dark".to_string(), font_size: 14 })
    } else {
        Settings { theme: "dark".to_string(), font_size: 14 }
    };
    let initial_api_key = std::env::var("OPENAI_API_KEY").unwrap_or_else(|_| "default".to_string());
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    println!("VSCodium Rust Tauri starting...");
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            println!("Tauri setup complete. Window should be visible.");
            Ok(())
        })
        .manage(EditorState {
            buffers: Mutex::new(HashMap::new()),
            active_path: Mutex::new(None),
            settings: Mutex::new(initial_settings),
            terminal_masters: Mutex::new(HashMap::new()),
            terminal_writers: Mutex::new(HashMap::new()),
            lsp_client: Arc::new(Mutex::new(LspClient::new())),
            context_keys: Arc::new(ContextKeyRegistry::new()),
            ext_host: Arc::new(Mutex::new(ExtensionHostManager::new())),
            keybindings: Arc::new(Mutex::new(KeybindingRegistry::new())),
            debug_manager: Arc::new(Mutex::new(DebugManager::new())),
            activation_manager: Arc::new(Mutex::new(ActivationManager::new())),
            perf_monitor: Arc::new(PerformanceMonitor::new()),
            _ai_engine: Arc::new(tokio::sync::Mutex::new(AiEngine::new(initial_api_key, current_dir))),
            browser_state: Arc::new(BrowserState::new()),
            config_dir: config_dir.clone(),
            _active_root: Mutex::new(None),
            current_model: Mutex::new("gpt-4o".to_string()),
            active_device: Mutex::new(None),
            editor_tx,
        })
        .invoke_handler(tauri::generate_handler![
            open_file, save_file, get_highlights, sync_content, list_directory,
            open_folder, search_project, switch_to_buffer, get_git_branch, 
            git_status, git_stage, git_unstage, git_commit, get_settings, 
            update_settings, spawn_terminal, write_to_terminal, lsp_start, 
            lsp_send_request, lsp_stop, set_context_key, evaluate_when_clause, 
            resize_terminal, ext_host_init, ext_host_send, resolve_keybinding, 
            search_marketplace, install_extension, install_vsix, get_running_extensions, 
            debug_start, debug_send, debug_stop, check_activation_event, 
            get_process_stats, get_config_path, set_ai_model, adb_list_devices, 
            set_active_device, backend_ping, adb_install_and_run, rename_path, delete_path,
            get_file_tree, read_file, write_file, ai_chat, register_ida_pro
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
