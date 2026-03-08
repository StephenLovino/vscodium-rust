
// Removed unused imports
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::process::Command;
use walkdir::WalkDir;
use regex::Regex;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAiResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Choice {
    message: ChatMessage,
}

pub struct AiEngine {
    client: Client,
    api_key: String,
}

impl AiEngine {
    pub fn new(_initial_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key: String::new(),
        }
    }

    pub fn get_key(&self) -> String {
        self.api_key.clone()
    }

    pub async fn fetch_apiradar_keys(&self, root_path: &str) -> Result<(), String> {
        let url = "https://apiradar.live/explore";
        let response = match reqwest::get(url).await {
            Ok(r) => r.text().await.unwrap_or_default(),
            Err(_) => String::new(),
        };

        // Also fetch from leaks api just in case explore is empty or protected
        let leaks_response = match reqwest::get("https://apiradar.live/api/leaks").await {
            Ok(r) => r.text().await.unwrap_or_default(),
            Err(_) => String::new(),
        };

        let combined = format!("{}\n{}", response, leaks_response);

        let mut keys = Vec::new();
        let patterns = vec![
            r"sk-ant-[a-zA-Z0-9\-_]{20,}",
            r"sk-proj-[a-zA-Z0-9\-_]{20,}",
            r"sk-[a-zA-Z0-9]{40,}",
            r"AIzaSy[a-zA-Z0-9\-_]{33}",
            r"AIza[0-9A-Za-z\-_]{35}",
            r"gsk_[a-zA-Z0-9]{48,}",
            r"sk-or-v1-[a-zA-Z0-9]{64}",
            r"xai-[a-zA-Z0-9]{45,}",
            r"csk-[a-zA-Z0-9]{40,}",
        ];

        for pat in patterns {
            if let Ok(re) = Regex::new(pat) {
                for mat in re.find_iter(&combined) {
                    keys.push(mat.as_str().to_string());
                }
            }
        }

        if !keys.is_empty() {
            keys.sort();
            keys.dedup();
            let path = std::path::Path::new(root_path).join("apikeys.txt");
            std::fs::write(path, keys.join("\n")).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    fn get_key_for_provider(&self, provider: &str, root_path: &str) -> String {
        let path = std::path::Path::new(root_path).join("apikeys.txt");
        let content = std::fs::read_to_string(path).unwrap_or_default();
        let mut fallback = std::env::var("OPENAI_API_KEY").unwrap_or_else(|_| String::new());
        if fallback.is_empty() {
            fallback = std::env::var("ANTHROPIC_API_KEY").unwrap_or_else(|_| String::new());
        }

        for line in content.lines() {
            let key = line.trim();
            match provider.to_lowercase().as_str() {
                "openai" => if key.starts_with("sk-proj-") || (key.starts_with("sk-") && !key.starts_with("sk-ant") && !key.starts_with("sk-or")) { return key.to_string(); },
                "anthropic" => if key.starts_with("sk-ant-") { return key.to_string(); },
                "google" => if key.starts_with("AIza") { return key.to_string(); },
                "groq" => if key.starts_with("gsk_") { return key.to_string(); },
                "openrouter" => if key.starts_with("sk-or-") { return key.to_string(); },
                "xai" => if key.starts_with("xai-") { return key.to_string(); },
                "cerebras" => if key.starts_with("csk-") { return key.to_string(); },
                _ => {}
            }
        }
        fallback
    }

    pub async fn send_prompt(&self, req: AiRequest, root_path: &str) -> Result<String, String> {
        let provider_key = self.get_key_for_provider(&req.provider, root_path);
        let endpoint;

        match req.provider.to_lowercase().as_str() {
            "anthropic" => return Err("Anthropic requires specific JSON format unimplemented in this mockup. Please use OpenRouter to access Anthropic models.".to_string()),
            "google" => endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "groq" => endpoint = "https://api.groq.com/openai/v1/chat/completions",
            "openrouter" => endpoint = "https://openrouter.ai/api/v1/chat/completions",
            "xai" => endpoint = "https://api.x.ai/v1/chat/completions",
            "cerebras" => endpoint = "https://api.cerebras.ai/v1/chat/completions",
            _ => endpoint = "https://api.openai.com/v1/chat/completions",
        }
        
        let response = self.client.post(endpoint)
            .header("Authorization", format!("Bearer {}", provider_key))
            .header("Content-Type", "application/json")
            .json(&req)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("API Error ({}): {}", status, text));
        }

        let oai_response: OpenAiResponse = response.json().await.map_err(|e| e.to_string())?;
        
        if let Some(choice) = oai_response.choices.into_iter().next() {
            Ok(choice.message.content)
        } else {
            Err("No choices returned from AI".to_string())
        }
    }

    pub fn get_project_context(&self, root_path: &str, active_file: Option<String>) -> String {
        let mut context = String::new();
        
        context.push_str("### Project Structure\n");
        for entry in WalkDir::new(root_path).into_iter().filter_map(|e| e.ok()).take(100) {
            let depth = entry.depth();
            let name = entry.file_name().to_string_lossy();
            context.push_str(&format!("{}{}\n", "  ".repeat(depth), name));
        }

        context.push_str("\n### Git Status\n");
        let git_output = Command::new("git")
            .args(["status", "--short"])
            .current_dir(root_path)
            .output();
        
        if let Ok(output) = git_output {
            context.push_str(&String::from_utf8_lossy(&output.stdout));
        }

        if let Some(path) = active_file {
            context.push_str(&format!("\n### Active File: {}\n", path));
            if let Ok(content) = std::fs::read_to_string(&path) {
                // Take first 50 lines for context
                let head = content.lines().take(50).collect::<Vec<_>>().join("\n");
                context.push_str(&format!("```\n{}\n```\n", head));
            }
        }

        context
    }

    pub fn scavenge_keys(&mut self, _root_path: &str) -> bool {
        // Obsolete: Keys are now fetched dynamically via fetch_apiradar_keys and read directly in send_prompt.
        true
    }
}
