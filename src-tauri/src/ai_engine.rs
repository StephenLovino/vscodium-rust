use crate::ai_tools::AiTools;
use crate::mcp_registry::{McpRegistry, McpServerConfig};
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_field: String,
    pub function: ToolFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
}

pub struct AiEngine {
    client: Client,
    api_key: String,
    mcp_registry: Arc<McpRegistry>,
    ai_tools: Arc<AiTools>,
}

impl AiEngine {
    pub fn new(api_key: String, root_path: PathBuf) -> Self {
        Self {
            client: Client::new(),
            api_key,
            mcp_registry: Arc::new(McpRegistry::new()),
            ai_tools: Arc::new(AiTools::new(root_path)),
        }
    }

    pub async fn register_mcp_server(&self, config: McpServerConfig) -> Result<()> {
        self.mcp_registry.add_server(config).await
    }

    pub async fn register_ida_pro_mcp(&self, python_path: &str, script_path: &str) -> Result<()> {
        self.mcp_registry.add_server(McpServerConfig {
            name: "ida-pro".to_string(),
            command: python_path.to_string(),
            args: vec![script_path.to_string()],
        }).await
    }

    pub async fn get_available_tools(&self) -> Vec<Value> {
        let mut tools: Vec<Value> = self
            .ai_tools
            .list_tools()
            .into_iter()
            .map(|t| {
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema
                    }
                })
            })
            .collect();

        if let Ok(mcp_tools) = self.mcp_registry.list_tools().await {
            for mcp_tool in mcp_tools {
                tools.push(serde_json::json!({
                    "type": "function",
                    "function": mcp_tool
                }));
            }
        }

        tools
    }

    pub async fn send_prompt(&self, req: AiRequest) -> Result<String, String> {
        let provider_key = self.get_key_for_provider(&req.provider);
        let endpoint = self.get_endpoint(&req.provider);

        let mut messages = req.messages;
        let tools = self.get_available_tools().await;

        for _ in 0..5 {
            // Max 5 tool call iterations
            let payload = serde_json::json!({
                "model": req.model,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "temperature": req.temperature.unwrap_or(0.7),
            });

            let response = self
                .client
                .post(endpoint)
                .bearer_auth(&provider_key)
                .json(&payload)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let result: Value = response.json().await.map_err(|e| e.to_string())?;

            if let Some(error) = result.get("error") {
                return Err(format!("AI Error: {}", error));
            }

            let message_val = result["choices"][0]["message"].clone();
            let chat_message: ChatMessage =
                serde_json::from_value(message_val.clone()).map_err(|e| e.to_string())?;

            messages.push(chat_message.clone());

            if let Some(tool_calls) = chat_message.tool_calls {
                for tool_call in tool_calls {
                    let tool_result = self
                        .execute_tool(&tool_call.function.name, &tool_call.function.arguments)
                        .await;

                    messages.push(ChatMessage {
                        role: "tool".to_string(),
                        content: match tool_result {
                            Ok(v) => v.to_string(),
                            Err(e) => format!("Error: {}", e),
                        },
                        tool_calls: None,
                    });
                }
            } else {
                return Ok(chat_message.content);
            }
        }

        Err("Exceeded maximum tool call iterations".to_string())
    }

    async fn execute_tool(&self, name: &str, arguments_str: &str) -> Result<Value> {
        let arguments: Value = serde_json::from_str(arguments_str)?;

        // Try built-in tools first
        if let Ok(result) = self.ai_tools.call_tool(name, arguments.clone()) {
            return Ok(result);
        }

        // Then try MCP tools
        self.mcp_registry.call_tool(name, arguments).await
    }

    fn get_key_for_provider(&self, provider: &str) -> String {
        let env_var = match provider.to_lowercase().as_str() {
            "anthropic" => "ANTHROPIC_API_KEY",
            "google" => "GOOGLE_API_KEY",
            "groq" => "GROQ_API_KEY",
            "openrouter" => "OPENROUTER_API_KEY",
            "xai" => "XAI_API_KEY",
            "cerebras" => "CEREBRAS_API_KEY",
            _ => "OPENAI_API_KEY",
        };

        std::env::var(env_var).unwrap_or_else(|_| self.api_key.clone())
    }

    fn get_endpoint(&self, provider: &str) -> &'static str {
        match provider.to_lowercase().as_str() {
            "google" => {
                "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
            }
            "groq" => "https://api.groq.com/openai/v1/chat/completions",
            "openrouter" => "https://openrouter.ai/api/v1/chat/completions",
            "xai" => "https://api.x.ai/v1/chat/completions",
            "cerebras" => "https://api.cerebras.ai/v1/chat/completions",
            _ => "https://api.openai.com/v1/chat/completions",
        }
    }

    pub fn get_project_context(&self, root_path: &str, active_file: Option<String>) -> String {
        let mut context = String::new();

        context.push_str("### Project Structure\n");
        for entry in WalkDir::new(root_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .take(100)
        {
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
                let head = content.lines().take(50).collect::<Vec<_>>().join("\n");
                context.push_str(&format!("```\n{}\n```\n", head));
            }
        }

        context
    }
}
