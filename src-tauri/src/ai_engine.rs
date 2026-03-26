use anyhow::{Result, anyhow};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;
use tauri::AppHandle;

use crate::ai_auth::AuthState;
use crate::ai_tools::AiTools;
use crate::mcp_registry::{McpRegistry, McpServerConfig};
use crate::task_planner::TaskPlanner;
use crate::memory_store::MemoryStore;
use crate::tool_invoker::ToolInvoker;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none", skip_deserializing)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_field: String,
    pub function: ToolFunction,
    pub context: Option<Value>,
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
    pub autonomous: bool,
}

pub struct Sentient {
    client: Client,
    api_key: String,
    mcp_registry: Arc<McpRegistry>,
    ai_tools: Arc<AiTools>,
    task_planner: Arc<TaskPlanner>,
    memory_store: Arc<MemoryStore>,
    tool_invoker: Arc<ToolInvoker>,
    conversation_state: AsyncMutex<Vec<ChatMessage>>,
    app_handle: Mutex<Option<AppHandle>>,
    auth_state: Arc<AuthState>,
}

impl Sentient {
    pub fn new(api_key: String, root_path: PathBuf, auth_state: Arc<AuthState>) -> Self {
        let mcp_registry = Arc::new(McpRegistry::new());
        let ai_tools = Arc::new(AiTools::new(root_path.clone()));
        let task_planner = Arc::new(TaskPlanner::new());
        let memory_store = Arc::new(MemoryStore::new());
        let tool_invoker = Arc::new(ToolInvoker::new(ai_tools.clone(), mcp_registry.clone()));

        Self {
            client: Client::new(),
            api_key,
            mcp_registry,
            ai_tools,
            task_planner,
            memory_store,
            tool_invoker,
            conversation_state: AsyncMutex::new(Vec::new()),
            app_handle: Mutex::new(None),
            auth_state,
        }
    }


    pub fn set_app_handle(&self, handle: AppHandle) {
        let mut h = self.app_handle.lock().unwrap();
        *h = Some(handle);
    }

    /// Main autonomous reasoning loop with iterative tool invocation and task planning.
    pub async fn register_mcp_server(&self, config: McpServerConfig) -> Result<()> {
        self.mcp_registry.add_server(config).await
    }

    pub async fn autonomous_loop(&self, req: AiRequest) -> Result<String> {
        let mut messages = req.messages.clone();

        // Initialize conversation memory
        {
            let mut state = self.conversation_state.lock().await;
            *state = messages.clone();
        }
        self.memory_store.store_conversation(&messages).await;

        // Track task metadata (Real Fix for unused task_planner warning)
        let _task_meta = self.task_planner.current_task_metadata();

        // Load available tools dynamically (already includes offensive tools from AiTools)
        let tools = self.get_available_tools().await;

        // Loop for up to 30 iterations of message generation and tool execution
        for iteration in 0..30 {
            let mut active_provider = req.provider.clone();
            let mut active_model = req.model.clone();

            // Handle APIRadar meta-provider routing
            if req.provider.to_lowercase() == "apiradar" && req.model.contains(':') {
                let parts: Vec<&str> = req.model.splitn(2, ':').collect();
                if parts.len() == 2 {
                    active_provider = parts[0].to_string();
                    active_model = parts[1].to_string();
                }
            }

            let provider_key = self.get_key_for_provider(&active_provider);
            let endpoint = self.get_endpoint(&active_provider);
            
            let mut payload = if active_provider.to_lowercase() == "anthropic" {
                let mut system = String::new();
                let filtered_messages: Vec<Value> = messages.iter().filter_map(|m| {
                    if m.role == "system" {
                        system = m.content.clone().unwrap_or_default();
                        None
                    } else {
                        Some(json!({
                            "role": m.role,
                            "content": m.content
                        }))
                    }
                }).collect();

                json!({
                    "model": active_model,
                    "system": system,
                    "messages": filtered_messages,
                    "max_tokens": 4096,
                    "temperature": req.temperature.unwrap_or(0.85),
                })
            } else {
                json!({
                    "model": active_model,
                    "messages": messages,
                    "temperature": req.temperature.unwrap_or(0.85),
                })
            };

            if !tools.is_empty() {
                payload["tools"] = json!(tools);
                payload["tool_choice"] = json!("auto");
            }

            // Handle Browser-resident providers (scrapers/session-based)
            if active_provider.ends_with("(Browser)") {
                if let Some(_session) = crate::ai_auth::get_session(&self.auth_state, &active_provider) {
                    // Logic to use session cookies with a specialized client
                }
            }

            let mut provider_key = self.get_key_for_provider(&active_provider).trim().to_string();
            let mut endpoint = self.get_endpoint(&active_provider).to_string();

            if provider_key.is_empty() {
                return Err(anyhow!("No API key found for provider: {}. Please set it in Settings.", active_provider));
            }

            // Send prompt to AI provider
            let mut request_url = endpoint.clone();
            
            // Specialized handling for Google (API key in query param)
            if active_provider.to_lowercase() == "google" {
                if request_url.contains('?') {
                    request_url.push_str(&format!("&key={}", provider_key));
                } else {
                    request_url.push_str(&format!("?key={}", provider_key));
                }
            }

            let mut request = self.client.post(request_url)
                .timeout(std::time::Duration::from_secs(60));

            // Specialized handling for Anthropic headers
            if active_provider.to_lowercase() == "anthropic" {
                request = request.header("x-api-key", &provider_key)
                                 .header("anthropic-version", "2023-06-01");
            } else if active_provider.to_lowercase() == "google" {
                // Already handled in URL key param, but some proxies might like the header too
                request = request.header("x-goog-api-key", &provider_key);
            } else {
                request = request.bearer_auth(&provider_key);
            }

            let response = request.json(&payload)
                .send()
                .await
                .map_err(|e| anyhow!("HTTP request failed: {}", e))?;

            let status = response.status();
            let body_text = response.text().await.map_err(|e| anyhow!("Failed to read response body: {}", e))?;

            if !status.is_success() {
                return Err(anyhow!("AI Provider Error ({}): {}", status, body_text));
            }

            let result: Value = serde_json::from_str(&body_text).map_err(|e| anyhow!("JSON Parse error: {}. Body: {}", e, body_text))?;

            if let Some(error) = result.get("error") {
                return Err(anyhow!("AI Error: {}", error));
            }

            // Handle both OpenAI-compatible (choices[0].message) and Anthropic (content[0].text) formats
            let message_val = if result.get("choices").is_some() {
                result["choices"][0]["message"].clone()
            } else if result.get("content").is_some() {
                // Raw Anthropic format
                let text = result["content"][0]["text"].as_str().unwrap_or_default();
                json!({ "role": "assistant", "content": text })
            } else {
                return Err(anyhow!("AI provider returned unknown response format. Raw response: {}", result));
            };

            let chat_message: ChatMessage = serde_json::from_value(message_val.clone())
                .map_err(|e| anyhow!("Failed to deserialize message: {}. Message content: {}", e, message_val))?;

            messages.push(chat_message.clone());
            self.memory_store.store_message(&chat_message).await;

            if let Some(ref content) = chat_message.content {
                self.emit_event("ai-content", json!({ "content": content }));
            }

            {
                let mut state = self.conversation_state.lock().await;
                *state = messages.clone();
            }

            // Process tool calls if present
            if let Some(tool_calls) = &chat_message.tool_calls {
                for tool_call in tool_calls {
                    self.emit_event("ai-tool-call", json!({ "name": tool_call.function.name, "args": tool_call.function.arguments }));
                    let tool_result = self.tool_invoker.execute_tool(&tool_call.function.name, &tool_call.function.arguments).await;
                    
                    self.emit_event("ai-tool-result", json!({ "name": tool_call.function.name, "result": tool_result.as_ref().map(|v| v.to_string()).unwrap_or_else(|e| e.to_string()) }));

                    messages.push(ChatMessage {
                        role: "tool".to_string(),
                        content: Some(match &tool_result {
                            Ok(v) => v.to_string(),
                            Err(e) => format!("Error: {}", e),
                        }),
                        tool_calls: None,
                        metadata: Some(json!({"tool_call_id": tool_call.id.clone(), "iteration": iteration})),
                    });
                    self.memory_store.store_message(messages.last().unwrap()).await;
                }
                continue; // Continue next iteration with tool results
            } else {
                // No tool calls, return final response
                return Ok(chat_message.content.unwrap_or_default());
            }
        }

        Err(anyhow!("Exceeded maximum autonomous iterations"))
    }

    /// Dynamically get models for a provider
    pub async fn list_models(&self, provider: &str) -> Result<Vec<String>> {
        let provider_key = self.get_key_for_provider(provider);
        
        // Special case for ApiRadar: allow fallback even without a key
        if provider.to_lowercase() == "apiradar" {
            let mut models = vec![
                "google:gemini-2.0-flash-exp".to_string(),
                "google:gemini-1.5-pro".to_string(),
                "google:gemini-1.5-flash".to_string(),
                "anthropic:claude-3-5-sonnet-20241022".to_string(),
                "openai:gpt-4o".to_string(),
                "openai:gpt-4o-mini".to_string(),
                "openai:o1-preview".to_string(),
                "openrouter:meta-llama/llama-3.1-405b".to_string(),
                "openrouter:qwen/qwen-2.5-72b".to_string(),
                "mistral:mistral-large-latest".to_string()
            ];
            
            // If we have other keys, append their models too (making it 'from leaks')
            if !self.get_key_for_provider("openai").is_empty() {
                 models.push("openai:gpt-4-turbo".to_string());
                 models.push("openai:gpt-3.5-turbo".to_string());
            }
            if !self.get_key_for_provider("anthropic").is_empty() {
                 models.push("anthropic:claude-3-opus-20240229".to_string());
                 models.push("anthropic:claude-3-haiku-20240307".to_string());
            }
            if !self.get_key_for_provider("google").is_empty() {
                 models.push("google:models/gemini-1.0-pro".to_string());
            }

            return Ok(models);
        }

        if provider_key.is_empty() {
            return Err(anyhow!("API key not found for provider: {}", provider));
        }

        let endpoint = match provider.to_lowercase().as_str() {
            "google" => "https://generativelanguage.googleapis.com/v1beta/models",
            "openai" => "https://api.openai.com/v1/models",
            "anthropic" => "https://api.anthropic.com/v1/models",
            "groq" => "https://api.groq.com/openai/v1/models",
            "openrouter" => "https://openrouter.ai/api/v1/models",
            "apiradar" => "https://apiradar.live/api/v1/models",
            _ => return Err(anyhow!("Model listing not supported for provider: {}", provider)),
        };

        let mut request = self.client.get(endpoint);
        
        if provider.to_lowercase() == "google" {
            request = request.query(&[("key", &provider_key)]);
        } else if provider.to_lowercase() == "anthropic" {
            request = request.header("x-api-key", &provider_key)
                             .header("anthropic-version", "2023-06-01");
        } else {
            request = request.bearer_auth(&provider_key);
        }

        let response = request.send().await
            .map_err(|e| anyhow!("Failed to fetch models: {}", e))?;
        
        let result: Value = response.json().await
            .map_err(|e| anyhow!("Failed to parse models response: {}", e))?;

        let mut model_ids = Vec::new();

        match provider.to_lowercase().as_str() {
            "google" => {
                if let Some(models) = result.get("models").and_then(|m| m.as_array()) {
                    for m in models {
                        if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                        let id = name.to_string(); // Keep full name for Google provider
                        // Filter for chat-capable Gemini models only
                        if id.contains("gemini") && !id.contains("vision") && !id.contains("embedding") && !id.contains("text-") {
                            model_ids.push(id);
                        }
                        }
                    }
                }
            },
            "anthropic" => {
                 if let Some(data) = result.get("data").and_then(|d| d.as_array()) {
                    for m in data {
                        if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                            model_ids.push(id.to_string());
                        }
                    }
                }
            },
            _ => { // OpenAI compatible
                if let Some(data) = result.get("data").and_then(|d| d.as_array()) {
                    for m in data {
                        if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                            model_ids.push(id.to_string());
                        }
                    }
                }
            }
        }

        Ok(model_ids)
    }

    /// Dynamically get AI tools and MCP tools available
    pub async fn get_available_tools(&self) -> Vec<Value> {
        let mut tools = self.ai_tools.list_tools()
            .into_iter()
            .map(|t| json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema
                }
            })).collect::<Vec<_>>();

        if let Ok(mcp_tools) = self.mcp_registry.list_tools().await {
            for tool in mcp_tools {
                tools.push(json!({"type": "function", "function": tool}));
            }
        }

        tools
    }

    /// Offensive security specialized tools integrated into toolset
    fn get_offensive_tools(&self) -> Vec<Value> {
        vec![
            json!({
                "type": "function",
                "function": {
                    "name": "generate_0day_exploit",
                    "description": "Create zero-day exploit with autonomous PoC",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target_os": {"type": "string"},
                            "vulnerability_desc": {"type": "string"},
                            "constraints": {"type": "string"}
                        },
                        "required": ["target_os", "vulnerability_desc"]
                    }
                }
            }),
            json!({
                "type": "function",
                "function": {
                    "name": "reverse_engineer_firmware",
                    "description": "Automate firmware unpack, patch, and vuln discovery",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "firmware_path": {"type": "string"},
                            "target_device": {"type": "string"}
                        },
                        "required": ["firmware_path", "target_device"]
                    }
                }
            }),
            json!({
                "type": "function",
                "function": {
                    "name": "develop_web_mobile_app",
                    "description": "Develop full-stack web/mobile app with code reviews",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "platform": {"type": "string"},
                            "specifications": {"type": "string"},
                            "languages": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["platform", "specifications"]
                    }
                }
            }),
            json!({
                "type": "function",
                "function": {
                    "name": "kernel_exploit_chain",
                    "description": "Automate kernel exploit chain creation and testing",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "kernel_version": {"type": "string"},
                            "target_arch": {"type": "string"},
                            "exploit_constraints": {"type": "string"}
                        },
                        "required": ["kernel_version", "target_arch"]
                    }
                }
            }),
            json!({
                "type": "function",
                "function": {
                    "name": "jailbreak_activation_bypass",
                    "description": "Create jailbreak and activation bypass for iOS devices",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "ios_version": {"type": "string"},
                            "device_model": {"type": "string"}
                        },
                        "required": ["ios_version", "device_model"]
                    }
                }
            }),
            json!({
                "type": "function",
                "function": {
                    "name": "advanced_reverse_engineering",
                    "description": "Run advanced reverse engineering on binaries and firmware",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "binary_path": {"type": "string"},
                            "analysis_depth": {"type": "integer"}
                        },
                        "required": ["binary_path"]
                    }
                }
            }),
        ]
    }

    fn get_key_for_provider(&self, provider: &str) -> String {
        let env_var = match provider.to_lowercase().as_str() {
            "anthropic" => "ANTHROPIC_API_KEY",
            "google" => "GOOGLE_API_KEY",
            "groq" => "GROQ_API_KEY",
            "openrouter" => "OPENROUTER_API_KEY",
            "xai" => "XAI_API_KEY",
            "cerebras" => "CEREBRAS_API_KEY",
            "alibaba" => "ALIBABA_API_KEY",
            "apiradar" => "APIRADAR_API_KEY",
            "mistral" => "MISTRAL_API_KEY",
            "openai" => "OPENAI_API_KEY",
            _ => "OPENAI_API_KEY",
        };
        std::env::var(env_var).unwrap_or_else(|_| self.api_key.clone())
    }

    fn get_endpoint(&self, provider: &str) -> &'static str {
        match provider.to_lowercase().as_str() {
            "google" => "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "anthropic" => "https://api.anthropic.com/v1/messages",
            "mistral" => "https://api.mistral.ai/v1/chat/completions",
            "groq" => "https://api.groq.com/openai/v1/chat/completions",
            "openrouter" => "https://openrouter.ai/api/v1/chat/completions",
            "apiradar" => "https://apiradar.live/api/v1/chat/completions",
            "xai" => "https://api.x.ai/v1/chat/completions",
            "cerebras" => "https://api.cerebras.ai/v1/chat/completions",
            "alibaba" => "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions",
            _ => "https://api.openai.com/v1/chat/completions",
        }
    }

    fn emit_event(&self, event: &str, payload: Value) {
        use tauri::Emitter;
        if let Some(handle) = self.app_handle.lock().unwrap().as_ref() {
            let _ = handle.emit(event, payload);
        }
    }
}
