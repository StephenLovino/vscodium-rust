use std::sync::Arc;
use tokio::sync::Mutex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiRequest {
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
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    pub fn update_key(&mut self, api_key: String) {
        self.api_key = api_key;
    }

    pub fn get_client(&self) -> Client {
        self.client.clone()
    }

    pub fn get_key(&self) -> String {
        self.api_key.clone()
    }

    pub async fn send_prompt(&self, req: AiRequest) -> Result<String, String> {
        let endpoint = "https://api.openai.com/v1/chat/completions";
        
        let response = self.client.post(endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
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

    pub fn scavenge_keys(&mut self) -> bool {
        // Look for keys in .env or scanned.txt in common locations
        let common_files = [".env", "scanned.txt", "keys.txt"];
        let mut found = false;

        for file in common_files {
            if let Ok(content) = std::fs::read_to_string(file) {
                for line in content.lines() {
                    if line.contains("OPENAI_API_KEY") || line.contains("sk-") {
                        let parts: Vec<&str> = line.split('=').collect();
                        let key = if parts.len() > 1 {
                            parts[1].trim().trim_matches('"').to_string()
                        } else {
                            line.trim().to_string()
                        };

                        if key.starts_with("sk-") {
                            self.api_key = key;
                            found = true;
                            break;
                        }
                    }
                }
            }
            if found { break; }
        }
        found
    }
}
