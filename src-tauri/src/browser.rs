use headless_chrome::{Browser, LaunchOptions};
use std::sync::Mutex;
use base64::{Engine as _, engine::general_purpose};

pub struct BrowserState {
    pub browser: Mutex<Option<Browser>>,
}

impl BrowserState {
    pub fn new() -> Self {
        Self {
            browser: Mutex::new(None),
        }
    }
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_open(state: tauri::State<'_, BrowserState>) -> Result<String, String> {
    let mut browser_lock = state.browser.lock().unwrap();
    if browser_lock.is_some() {
        return Ok("Browser already open".to_string());
    }

    let options = LaunchOptions::default_builder()
        .headless(true)
        .build()
        .map_err(|e| e.to_string())?;

    let browser = Browser::new(options).map_err(|e| e.to_string())?;
    *browser_lock = Some(browser);

    Ok("Browser launched successfully".to_string())
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_navigate(state: tauri::State<'_, BrowserState>, url: String) -> Result<String, String> {
    let browser_lock = state.browser.lock().unwrap();
    let browser = browser_lock.as_ref().ok_or("Browser not launched")?;

    let tab = browser.new_tab().map_err(|e| e.to_string())?;
    tab.navigate_to(&url).map_err(|e| e.to_string())?;
    tab.wait_until_navigated().map_err(|e| e.to_string())?;

    Ok(format!("Navigated to {}", url))
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_screenshot(state: tauri::State<'_, BrowserState>) -> Result<String, String> {
    let browser_lock = state.browser.lock().unwrap();
    let browser = browser_lock.as_ref().ok_or("Browser not launched")?;

    let tab = browser.get_tabs().lock().unwrap().first().ok_or("No tabs open")?.clone();
    let jpeg_data = tab.capture_screenshot(
        headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Jpeg,
        None,
        None,
        true
    ).map_err(|e| e.to_string())?;

    Ok(general_purpose::STANDARD.encode(jpeg_data))
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_click(state: tauri::State<'_, BrowserState>, selector: String) -> Result<String, String> {
    let browser_lock = state.browser.lock().unwrap();
    let browser = browser_lock.as_ref().ok_or("Browser not launched")?;

    let tab = browser.get_tabs().lock().unwrap().first().ok_or("No tabs open")?.clone();
    let element = tab.wait_for_element(&selector).map_err(|e| e.to_string())?;
    element.click().map_err(|e| e.to_string())?;

    Ok(format!("Clicked element: {}", selector))
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_type(state: tauri::State<'_, BrowserState>, selector: String, text: String) -> Result<String, String> {
    let browser_lock = state.browser.lock().unwrap();
    let browser = browser_lock.as_ref().ok_or("Browser not launched")?;

    let tab = browser.get_tabs().lock().unwrap().first().ok_or("No tabs open")?.clone();
    let element = tab.wait_for_element(&selector).map_err(|e| e.to_string())?;
    element.type_into(&text).map_err(|e| e.to_string())?;

    Ok(format!("Typed into {}: {}", selector, text))
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_read_dom(state: tauri::State<'_, BrowserState>) -> Result<String, String> {
    let browser_lock = state.browser.lock().unwrap();
    let browser = browser_lock.as_ref().ok_or("Browser not launched")?;

    let tab = browser.get_tabs().lock().unwrap().first().ok_or("No tabs open")?.clone();
    let content = tab.get_content().map_err(|e| e.to_string())?;

    Ok(content)
}

#[tauri::command]
#[allow(dead_code)]
pub async fn browser_close(state: tauri::State<'_, BrowserState>) -> Result<String, String> {
    let mut browser_lock = state.browser.lock().unwrap();
    *browser_lock = None;
    Ok("Browser closed".to_string())
}
