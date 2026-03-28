use std::sync::Arc;
use tokio::sync::Mutex;
use headless_chrome::{Browser, LaunchOptions};
use serde::{Serialize, Deserialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
pub struct BrowserContext {
    pub url: String,
    pub title: String,
}

pub struct BrowserBridge {
    browser: Arc<Mutex<Option<Browser>>>,
}

impl BrowserBridge {
    pub fn new() -> Self {
        Self {
            browser: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn ensure_browser(&self) -> Result<Browser, String> {
        let mut browser_lock = self.browser.lock().await;
        if let Some(ref b) = *browser_lock {
            return Ok(b.clone());
        }

        let browser = Browser::new(LaunchOptions::default())
            .map_err(|e| format!("Failed to launch browser: {}", e))?;
        
        *browser_lock = Some(browser.clone());
        Ok(browser)
    }

    pub async fn capture_screenshot(&self, url: &str) -> Result<Vec<u8>, String> {
        let browser = self.ensure_browser().await?;
        let tab = browser.new_tab().map_err(|e| e.to_string())?;
        
        tab.navigate_to(url).map_err(|e| e.to_string())?;
        tab.wait_until_navigated().map_err(|e| e.to_string())?;
        
        let png_data = tab.capture_screenshot(
            headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
            None,
            None,
            true
        ).map_err(|e| e.to_string())?;
        
        Ok(png_data)
    }
}

pub fn init_browser_bridge<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let bridge = BrowserBridge::new();
    app.manage(bridge);
}
