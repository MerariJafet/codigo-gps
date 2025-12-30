#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;
use std::process::Command;
use std::thread;
use std::time::Duration;
use std::fs;
use std::path::PathBuf;
use serde_json::Value;

#[tauri::command]
fn get_auth_token() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_path = home.join(".codigo_gps/config.json");
    
    if !config_path.exists() {
        return Err("Config file not found".to_string());
    }

    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    if let Some(token) = json["auth_token"].as_str() {
        Ok(token.to_string())
    } else {
        Err("Token not found in config".to_string())
    }
}

fn check_backend_health() -> bool {
    let client = reqwest::blocking::Client::new();
    match client.get("http://127.0.0.1:8000/api/v1/health").timeout(Duration::from_secs(1)).send() {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

fn start_backend() {
    // Check path for codigo-gps executable
    // Assuming 'codigo-gps' is in PATH. If not, we might need absolute path.
    // If installed via pip as user, it's likely in ~/.local/bin/codigo-gps
    
    let status = Command::new("codigo-gps")
        .arg("daemon")
        .spawn();
        
    match status {
        Ok(_) => println!("Backend daemon started successfully"),
        Err(e) => {
             // Fallback: try ~/.local/bin/codigo-gps
             if let Some(home) = dirs::home_dir() {
                 let local_bin = home.join(".local/bin/codigo-gps");
                 if local_bin.exists() {
                     let _ = Command::new(local_bin)
                        .arg("daemon")
                        .spawn()
                        .map_err(|e| println!("Failed to start backend fallback: {}", e));
                 } else {
                     println!("Failed to start backend: {}", e);
                 }
             }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Check health in background? Or block startup slightly?
            // Better to block slightly to ensure UI loads with backend ready.
            if !check_backend_health() {
                println!("Backend not running. Starting...");
                start_backend();
                
                // Wait for up to 5 seconds
                for _ in 0..10 {
                    if check_backend_health() {
                        println!("Backend is up!");
                        break;
                    }
                    thread::sleep(Duration::from_millis(500));
                }
            } else {
                println!("Backend already running.");
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_auth_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
