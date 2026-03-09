use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
}

impl AiTools {
    pub fn new(root_path: PathBuf) -> Self {
        Self { root_path }
    }

    pub fn list_tools(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "read_file".to_string(),
                description: "Read the content of a file".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path to the file" }
                    },
                    "required": ["path"]
                }),
            },
            ToolDefinition {
                name: "write_file".to_string(),
                description: "Write content to a file. Overwrites if exists, creates if not."
                    .to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path to the file" },
                        "content": { "type": "string", "description": "Content to write" }
                    },
                    "required": ["path", "content"]
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
                name: "list_files".to_string(),
                description: "List files in a directory".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path to the directory (default: '.')", "default": "." }
                    }
                }),
            },
        ]
    }

    pub fn call_tool(&self, name: &str, arguments: Value) -> Result<Value> {
        match name {
            "read_file" => self.read_file(arguments),
            "write_file" => self.write_file(arguments),
            "delete_file" => self.delete_file(arguments),
            "list_files" => self.list_files(arguments),
            _ => Err(anyhow!("Unknown built-in tool: {}", name)),
        }
    }

    fn read_file(&self, args: Value) -> Result<Value> {
        let path_str = args
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing path"))?;
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
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing path"))?;
        let content = args
            .get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing content"))?;
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
        let full_path = self.root_path.join(path_str);

        if !full_path.starts_with(&self.root_path) {
            return Err(anyhow!("Access denied: path outside project root"));
        }

        let mut files = Vec::new();
        for entry in fs::read_dir(full_path)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type()?.is_dir();
            files.push(serde_json::json!({
                "name": name,
                "type": if is_dir { "directory" } else { "file" }
            }));
        }
        Ok(Value::Array(files))
    }
}
