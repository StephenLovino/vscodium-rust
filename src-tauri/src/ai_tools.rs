use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

pub struct AiTools {
    root_path: PathBuf,
    browser_state: Arc<crate::browser::BrowserState>,
}

impl AiTools {
    pub fn new(root_path: PathBuf, browser_state: Arc<crate::browser::BrowserState>) -> Self {
        Self { root_path, browser_state }
    }

    pub fn list_tools(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "view_file".to_string(),
                description: "Read the content of a file".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "TargetFile": { "type": "string", "description": "Relative path to the file" }
                    },
                    "required": ["TargetFile"]
                }),
            },
            ToolDefinition {
                name: "write_to_file".to_string(),
                description: "Write content to a file. Overwrites if exists, creates if not."
                    .to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "TargetFile": { "type": "string", "description": "Relative path to the file" },
                        "CodeContent": { "type": "string", "description": "Content to write" }
                    },
                    "required": ["TargetFile", "CodeContent"]
                }),
            },
            ToolDefinition {
                name: "delete_file".to_string(),
                description: "Delete a file".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path to the file" }
                    },
                    "required": ["path"]
                }),
            },
            ToolDefinition {
                name: "list_dir".to_string(),
                description: "List files in a directory".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path to the directory (default: '.')", "default": "." },
                        "recursive": { "type": "boolean", "description": "Whether to list recursively", "default": false }
                    }
                }),
            },
            ToolDefinition {
                name: "run_command".to_string(),
                description: "Run a shell command in the project root and get output".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string", "description": "The command to run" }
                    },
                    "required": ["command"]
                }),
            },
            ToolDefinition {
                name: "grep".to_string(),
                description: "Fast recursive search within files using system grep or ripgrep".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "The string to search for" },
                        "path": { "type": "string", "description": "The directory to search in (default: '.')", "default": "." }
                    },
                    "required": ["query"]
                }),
            },
            ToolDefinition {
                name: "search_files".to_string(),
                description: "Search for a string across all files in the project".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "The string or regex to search for" }
                    },
                    "required": ["query"]
                }),
            },
            ToolDefinition {
                name: "code_generation".into(),
                description: "Generate code in multiple languages".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "language": {"type": "string"},
                        "specification": {"type": "string"},
                    },
                    "required": ["language", "specification"]
                }),
            },
            ToolDefinition {
                name: "generate_0day_exploit".into(),
                description: "Create zero-day exploit with autonomous PoC".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "target_os": {"type": "string"},
                        "vulnerability_desc": {"type": "string"},
                        "constraints": {"type": "string"}
                    },
                    "required": ["target_os", "vulnerability_desc"]
                }),
            },
            ToolDefinition {
                name: "reverse_engineer_firmware".into(),
                description: "Automate firmware unpack, patch, and vuln discovery".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "firmware_path": {"type": "string"},
                        "target_device": {"type": "string"}
                    },
                    "required": ["firmware_path", "target_device"]
                }),
            },
            ToolDefinition {
                name: "develop_web_mobile_app".into(),
                description: "Develop full-stack web/mobile app with code reviews".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "platform": {"type": "string"},
                        "specifications": {"type": "string"},
                        "languages": {"type": "array", "items": {"type": "string"}}
                    },
                    "required": ["platform", "specifications"]
                }),
            },
            ToolDefinition {
                name: "kernel_exploit_chain".into(),
                description: "Automate kernel exploit chain creation and testing".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "kernel_version": {"type": "string"},
                        "target_arch": {"type": "string"},
                        "exploit_constraints": {"type": "string"}
                    },
                    "required": ["kernel_version", "target_arch"]
                }),
            },
            ToolDefinition {
                name: "jailbreak_activation_bypass".into(),
                description: "Create jailbreak and activation bypass for iOS devices".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "ios_version": {"type": "string"},
                        "device_model": {"type": "string"}
                    },
                    "required": ["ios_version", "device_model"]
                }),
            },
            ToolDefinition {
                name: "advanced_reverse_engineering".into(),
                description: "Run advanced reverse engineering on binaries and firmware".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "binary_path": {"type": "string"},
                        "analysis_depth": {"type": "integer"}
                    },
                    "required": ["binary_path"]
                }),
            },
            ToolDefinition {
                name: "terminal_send_data".into(),
                description: "Send raw data/commands to the active terminal session".into(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "data": {"type": "string", "description": "The string/command to send (include \\n for enter)"},
                        "term_id": {"type": "string", "description": "The ID of the terminal to send to (optional, defaults to active)"}
                    },
                    "required": ["data"]
                }),
            },
            ToolDefinition {
                name: "browser_open".into(),
                description: "Open a new headless browser instance".into(),
                input_schema: json!({"type": "object", "properties": {}}),
            },
            ToolDefinition {
                name: "browser_navigate".into(),
                description: "Navigate the browser to a URL".into(),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "The URL to navigate to"}
                    },
                    "required": ["url"]
                }),
            },
            ToolDefinition {
                name: "browser_screenshot".into(),
                description: "Capture a screenshot of the current page and return as base64".into(),
                input_schema: json!({"type": "object", "properties": {}}),
            },
            ToolDefinition {
                name: "browser_click".into(),
                description: "Click an element on the page using a CSS selector".into(),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "selector": {"type": "string", "description": "The CSS selector to click"}
                    },
                    "required": ["selector"]
                }),
            },
            ToolDefinition {
                name: "browser_type".into(),
                description: "Type text into an element on the page using a CSS selector".into(),
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "selector": {"type": "string", "description": "The CSS selector to type into"},
                        "text": {"type": "string", "description": "The text to type"}
                    },
                    "required": ["selector", "text"]
                }),
            },
            ToolDefinition {
                name: "browser_read_dom".into(),
                description: "Read the full HTML content of the current page".into(),
                input_schema: json!({"type": "object", "properties": {}}),
            },
            ToolDefinition {
                name: "browser_close".into(),
                description: "Close the headless browser instance".into(),
                input_schema: json!({"type": "object", "properties": {}}),
            },
            ToolDefinition {
                name: "find_api_keys".into(),
                description: "Search the codebase for leaked API keys using common dorking patterns (OpenAI, GitHub, Google)".into(),
                input_schema: json!({"type": "object", "properties": {}}),
            },
        ]
    }

    pub fn call_tool(&self, name: &str, arguments: Value) -> Result<Value> {
        match name {
            "view_file" => self.read_file(arguments),
            "write_to_file" => self.write_file(arguments),
            "delete_file" => self.delete_file(arguments),
            "list_dir" => self.list_files(arguments),
            "run_command" => self.run_command(arguments),
            "search_files" => self.search_files(arguments),
            "grep" => self.grep(arguments),
            "terminal_send_data" => self.terminal_send_data(arguments),
            "browser_open" => self.browser_open(arguments),
            "browser_navigate" => self.browser_navigate(arguments),
            "browser_screenshot" => self.browser_screenshot(arguments),
            "browser_click" => self.browser_click(arguments),
            "browser_type" => self.browser_type(arguments),
            "browser_read_dom" => self.browser_read_dom(arguments),
            "browser_close" => self.browser_close(arguments),
            "find_api_keys" => self.find_api_keys(arguments),
            "code_generation" => Ok(serde_json::json!({"result": "Code generated based on specification. (Mock implementation)"})),
            "generate_0day_exploit" => Ok(serde_json::json!({"status": "Exploit generated and verified in sandbox environment. (Mock implementation)"})),
            "reverse_engineer_firmware" => Ok(serde_json::json!({"analysis": "Firmware unpacked. No critical vulnerabilities found in first pass. (Mock implementation)"})),
            "develop_web_mobile_app" => Ok(serde_json::json!({"status": "App boilerplate generated and ready for review. (Mock implementation)"})),
            "kernel_exploit_chain" => Ok(serde_json::json!({"status": "Kernel exploit chain completed. (Mock implementation)"})),
            "jailbreak_activation_bypass" => Ok(serde_json::json!({"status": "Jailbreak sequence prepared. (Mock implementation)"})),
            "advanced_reverse_engineering" => Ok(serde_json::json!({"result": "Advanced analysis complete. (Mock implementation)"})),
            _ => Err(anyhow!("Unknown built-in tool: {}", name)),
        }
    }

    fn read_file(&self, args: Value) -> Result<Value> {
        let path_str = args
            .get("TargetFile")
            .or_else(|| args.get("path"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing TargetFile"))?;
        let full_path = self.root_path.join(path_str);

        // Security check: ensure path is within root
        if !full_path.starts_with(&self.root_path) {
            return Err(anyhow!("Access denied: path outside project root"));
        }

        let content = fs::read_to_string(full_path)?;
        Ok(Value::String(content))
    }

    fn write_file(&self, args: Value) -> Result<Value> {
        let path_str = args
            .get("TargetFile")
            .or_else(|| args.get("path"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing TargetFile"))?;
        let content = args
            .get("CodeContent")
            .or_else(|| args.get("content"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing CodeContent"))?;
        let full_path = self.root_path.join(path_str);

        if !full_path.starts_with(&self.root_path) {
            return Err(anyhow!("Access denied: path outside project root"));
        }

        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(full_path, content)?;
        Ok(serde_json::json!({ "status": "success" }))
    }

    fn delete_file(&self, args: Value) -> Result<Value> {
        let path_str = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing path"))?;
        let full_path = self.root_path.join(path_str);

        if !full_path.starts_with(&self.root_path) {
            return Err(anyhow!("Access denied: path outside project root"));
        }

        fs::remove_file(full_path)?;
        Ok(serde_json::json!({ "status": "success" }))
    }

    fn list_files(&self, args: Value) -> Result<Value> {
        let path_str = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
        let recursive = args.get("recursive").and_then(|v| v.as_bool()).unwrap_or(false);
        let full_path = self.root_path.join(path_str);

        if !full_path.starts_with(&self.root_path) {
            return Err(anyhow!("Access denied: path outside project root"));
        }

        let mut files = Vec::new();
        if recursive {
            use walkdir::WalkDir;
            for entry in WalkDir::new(full_path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                let rel_path = entry.path().strip_prefix(&self.root_path)?.to_string_lossy().to_string();
                let is_dir = entry.file_type().is_dir();
                files.push(serde_json::json!({
                    "path": rel_path,
                    "type": if is_dir { "directory" } else { "file" }
                }));
            }
        } else {
            for entry in fs::read_dir(full_path)? {
                let entry = entry?;
                let name = entry.file_name().to_string_lossy().to_string();
                let is_dir = entry.file_type()?.is_dir();
                files.push(serde_json::json!({
                    "name": name,
                    "type": if is_dir { "directory" } else { "file" }
                }));
            }
        }
        Ok(Value::Array(files))
    }

    fn run_command(&self, args: Value) -> Result<Value> {
        let command = args.get("command").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing command"))?;
        
        let output = if cfg!(target_os = "windows") {
            std::process::Command::new("powershell")
                .args(&["-Command", command])
                .current_dir(&self.root_path)
                .output()?
        } else {
            std::process::Command::new("sh")
                .args(&["-c", command])
                .current_dir(&self.root_path)
                .output()?
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(serde_json::json!({
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": output.status.code()
        }))
    }

    fn search_files(&self, args: Value) -> Result<Value> {
        let query = args.get("query").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing query"))?;
        
        let mut results = Vec::new();
        use walkdir::WalkDir;
        for entry in WalkDir::new(&self.root_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let content = fs::read_to_string(entry.path());
                if let Ok(content) = content {
                    for (i, line) in content.lines().enumerate() {
                        if line.contains(query) {
                            results.push(serde_json::json!({
                                "file": entry.path().strip_prefix(&self.root_path)?.to_string_lossy().to_string(),
                                "line": i + 1,
                                "match": line.trim()
                            }));
                        }
                        if results.len() > 100 { break; }
                    }
                }
            }
            if results.len() > 100 { break; }
        }
        Ok(Value::Array(results))
    }

    fn browser_open(&self, _args: Value) -> Result<Value> {
        use headless_chrome::{Browser, LaunchOptions};
        let mut browser_lock = self.browser_state.browser.lock().unwrap();
        if browser_lock.is_some() {
            return Ok(serde_json::json!({"status": "already_open"}));
        }

        let options = LaunchOptions::default_builder()
            .headless(true)
            .build()
            .map_err(|e| anyhow!(e.to_string()))?;

        let browser = Browser::new(options).map_err(|e| anyhow!(e.to_string()))?;
        *browser_lock = Some(browser);

        Ok(serde_json::json!({"status": "success", "message": "Browser launched"}))
    }

    fn browser_navigate(&self, args: Value) -> Result<Value> {
        let url = args.get("url").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing url"))?;
        let browser_lock = self.browser_state.browser.lock().unwrap();
        let browser = browser_lock.as_ref().ok_or_else(|| anyhow!("Browser not launched"))?;

        let tab = browser.new_tab().map_err(|e| anyhow!(e.to_string()))?;
        tab.navigate_to(url).map_err(|e| anyhow!(e.to_string()))?;
        tab.wait_until_navigated().map_err(|e| anyhow!(e.to_string()))?;

        Ok(serde_json::json!({"status": "success", "message": format!("Navigated to {}", url)}))
    }

    fn browser_screenshot(&self, _args: Value) -> Result<Value> {
        use base64::{Engine as _, engine::general_purpose};
        let browser_lock = self.browser_state.browser.lock().unwrap();
        let browser = browser_lock.as_ref().ok_or_else(|| anyhow!("Browser not launched"))?;

        let tab = browser.get_tabs().lock().unwrap().first().ok_or_else(|| anyhow!("No tabs open"))?.clone();
        let jpeg_data = tab.capture_screenshot(
            headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Jpeg,
            None, None, true
        ).map_err(|e| anyhow!(e.to_string()))?;

        Ok(serde_json::json!({"status": "success", "screenshot": general_purpose::STANDARD.encode(jpeg_data)}))
    }

    fn browser_click(&self, args: Value) -> Result<Value> {
        let selector = args.get("selector").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing selector"))?;
        let browser_lock = self.browser_state.browser.lock().unwrap();
        let browser = browser_lock.as_ref().ok_or_else(|| anyhow!("Browser not launched"))?;

        let tab = browser.get_tabs().lock().unwrap().first().ok_or_else(|| anyhow!("No tabs open"))?.clone();
        let element = tab.wait_for_element(selector).map_err(|e| anyhow!(e.to_string()))?;
        element.click().map_err(|e| anyhow!(e.to_string()))?;

        Ok(serde_json::json!({"status": "success", "message": format!("Clicked {}", selector)}))
    }

    fn browser_type(&self, args: Value) -> Result<Value> {
        let selector = args.get("selector").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing selector"))?;
        let text = args.get("text").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing text"))?;
        let browser_lock = self.browser_state.browser.lock().unwrap();
        let browser = browser_lock.as_ref().ok_or_else(|| anyhow!("Browser not launched"))?;

        let tab = browser.get_tabs().lock().unwrap().first().ok_or_else(|| anyhow!("No tabs open"))?.clone();
        let element = tab.wait_for_element(selector).map_err(|e| anyhow!(e.to_string()))?;
        element.type_into(text).map_err(|e| anyhow!(e.to_string()))?;

        Ok(serde_json::json!({"status": "success", "message": format!("Typed into {}", selector)}))
    }

    fn browser_read_dom(&self, _args: Value) -> Result<Value> {
        let browser_lock = self.browser_state.browser.lock().unwrap();
        let browser = browser_lock.as_ref().ok_or_else(|| anyhow!("Browser not launched"))?;

        let tab = browser.get_tabs().lock().unwrap().first().ok_or_else(|| anyhow!("No tabs open"))?.clone();
        let content = tab.get_content().map_err(|e| anyhow!(e.to_string()))?;

        Ok(serde_json::json!({"status": "success", "dom": content}))
    }

    fn browser_close(&self, _args: Value) -> Result<Value> {
        let mut browser_lock = self.browser_state.browser.lock().unwrap();
        *browser_lock = None;
        Ok(serde_json::json!({"status": "success", "message": "Browser closed"}))
    }

    fn find_api_keys(&self, _args: Value) -> Result<Value> {
        let mut results = Vec::new();
        let extensions = vec![
            "xml", "json", "properties", "sql", "txt", "log", "tmp", "backup", "bak", "enc",
            "yml", "yaml", "toml", "ini", "config", "conf", "cfg", "env", "envrc", "prod",
            "secret", "private", "key"
        ];
        
        let openai_regex = regex::Regex::new(r"sk-[a-zA-Z0-9]{48}")?;
        let github_regex = regex::Regex::new(r"gh[pousr]_[a-zA-Z0-9]+")?;
        let google_regex = regex::Regex::new(r"AIza[0-9A-Za-z-_]{35}")?;
        
        use walkdir::WalkDir;
        for entry in WalkDir::new(&self.root_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let ext = entry.path().extension().and_then(|s| s.to_str()).unwrap_or("");
                if extensions.contains(&ext) || ext.is_empty() {
                    let content = fs::read_to_string(entry.path());
                    if let Ok(content) = content {
                         for (i, line) in content.lines().enumerate() {
                             let mut found = false;
                             let mut provider = "";
                             
                             if openai_regex.is_match(line) && (line.to_lowercase().contains("openai") || line.to_lowercase().contains("gpt")) {
                                 found = true;
                                 provider = "OpenAI";
                             } else if github_regex.is_match(line) && (line.to_lowercase().contains("github") || line.to_lowercase().contains("oauth")) {
                                 found = true;
                                 provider = "GitHub";
                             } else if google_regex.is_match(line) && line.contains("Google") && line.contains("AIza") {
                                 found = true;
                                 provider = "Google";
                             }
                             
                             if found {
                                 results.push(serde_json::json!({
                                     "provider": provider,
                                     "file": entry.path().strip_prefix(&self.root_path)?.to_string_lossy().to_string(),
                                     "line": i + 1,
                                     "context": line.trim()
                                 }));
                             }
                             if results.len() > 100 { break; }
                         }
                    }
                }
            }
            if results.len() > 100 { break; }
        }
        
        Ok(Value::Array(results))
    }

    fn grep(&self, args: Value) -> Result<Value> {
        let query = args.get("query").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing query"))?;
        let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
        
        let output = if cfg!(target_os = "windows") {
             std::process::Command::new("powershell")
                .args(&["-Command", &format!("Select-String -Path '{}' -Pattern '{}' -Recursive", path, query)])
                .current_dir(&self.root_path)
                .output()?
        } else {
            std::process::Command::new("grep")
                .args(&["-r", "-n", query, path])
                .current_dir(&self.root_path)
                .output()?
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(serde_json::json!({
            "results": stdout,
            "exit_code": output.status.code()
        }))
    }

    fn terminal_send_data(&self, args: Value) -> Result<Value> {
        let data = args.get("data").and_then(|v| v.as_str()).ok_or_else(|| anyhow!("Missing data"))?;
        // For now, redirecting to run_command as a fallback for the "send data" flow
        self.run_command(json!({"command": data}))
    }
}
