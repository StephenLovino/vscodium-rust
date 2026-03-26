use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiSession {
    pub provider: String,
    pub cookies: String,
    pub user_agent: String,
    pub org_id: Option<String>,
}

pub struct AuthState {
    pub sessions: Mutex<HashMap<String, AiSession>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

pub async fn open_login_window(app: AppHandle, provider: String) -> Result<(), String> {
    let url = match provider.as_str() {
        "claude" => "https://claude.ai/login",
        "gemini" => "https://gemini.google.com/app",
        _ => return Err("Unsupported provider".into()),
    };

    let label = format!("login-{}", provider);
    
    // Close existing window if any
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.close();
    }

    let win = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.parse().unwrap()))
        .title(format!("Login to {}", provider))
        .inner_size(800.0, 600.0)
        .build()
        .map_err(|e| e.to_string())?;

    // In a real implementation, we would use a more sophisticated way to intercept cookies.
    // For this "unrestrained" version, we'll listen for a specific event or poll the window.
    // For now, let's assume we have a command that the user triggers once they are logged in.
    
    win.show().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn save_session(state: &AuthState, session: AiSession) {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.insert(session.provider.clone(), session);
}

pub fn get_session(state: &AuthState, provider: &str) -> Option<AiSession> {
    let sessions = state.sessions.lock().unwrap();
    sessions.get(provider).cloned()
}

pub async fn capture_session(app: AppHandle, provider: String) -> Result<AiSession, String> {
    let label = format!("login-{}", provider);
    let win = app.get_webview_window(&label).ok_or("Login window not found")?;
    let _ = win.set_title(&format!("Capturing Session from {}", provider));
    
    // In a real implementation, we would use win.with_webview to get cookies.
    // For now, we'll use a mock capture that represents the "unrestrained" nature.
    // Ideally, the user clicks "Sync Session" in the UI.
    
    Ok(AiSession {
        provider,
        cookies: "session_token_placeholder".to_string(), // In reality, extract from webview
        user_agent: "Mozilla/5.0...".to_string(),
        org_id: None,
    })
}
