use crate::mcp_client::McpClient;
use anyhow::Result;
use tracing::instrument;

use std::sync::Arc;
use tokio::sync::RwLock;
use serde_json::Value;

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
}


pub struct McpRegistry {
    servers: Arc<RwLock<Vec<Arc<McpClient>>>>,
}

impl McpRegistry {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(RwLock::new(Vec::new())),
        }
    }

    #[instrument(skip(self))]
    pub async fn add_server(&self, config: McpServerConfig) -> Result<()> {

        let args: Vec<&str> = config.args.iter().map(|s| s.as_str()).collect();
        let client = McpClient::spawn(&config.command, args)?;
        
        let mut servers = self.servers.write().await;
        servers.push(client);
        
        Ok(())
    }

    #[instrument(skip(self))]
    pub async fn list_tools(&self) -> Result<Vec<Value>> {

        let servers = self.servers.read().await;
        let mut all_tools = Vec::new();
        
        for server in servers.iter() {
            if let Ok(result) = server.call("list_tools", Value::Object(Default::default())).await {
                if let Some(tools) = result.get("tools").and_then(|t| t.as_array()) {
                    all_tools.extend(tools.clone());
                }
            }
        }
        
        Ok(all_tools)
    }

    #[instrument(skip(self))]
    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value> {

        let servers = self.servers.read().await;
        
        // This is a simple implementation that tries to find the tool by name
        // in all registered servers. A more robust implementation would
        // cache tool lists.
        for server in servers.iter() {
            let tools_result = server.call("list_tools", Value::Object(Default::default())).await;
            if let Ok(result) = tools_result {
                if let Some(tools) = result.get("tools").and_then(|t| t.as_array()) {
                    if tools.iter().any(|t| t.get("name").and_then(|n| n.as_str()) == Some(name)) {
                        let params = serde_json::json!({
                            "name": name,
                            "arguments": arguments
                        });
                        return server.call("call_tool", params).await;
                    }
                }
            }
        }
        
        Err(anyhow::anyhow!("Tool not found: {}", name))
    }
    pub async fn list_servers(&self) -> Vec<String> {
        let servers = self.servers.read().await;
        // For now, return a placeholder since McpClient doesn't store the name internally 
        // (it's spawned from config). In a real implementation, we'd store the config too.
        servers.iter().map(|_| "Active MCP Server".to_string()).collect()
    }
}
