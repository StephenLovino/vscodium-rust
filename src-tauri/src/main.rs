// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(unexpected_cfgs)]

extern crate objc;

use cocoa::base::id;
use objc::{class, msg_send, sel, sel_impl};
use std::time::Duration;
use gpui::AsyncApp;

fn main() {
    // 1. Initialize NSApplication on the main thread (required on macOS).
    // We use the GPUIApplication class defined in gpui_macos to ensure it has the necessary ivars.
    println!("Initializing NSApp on main thread...");
    unsafe {
        let _app: id = msg_send![class!(GPUIApplication), sharedApplication];
    }
    println!("NSApp initialized.");

    let (tx, rx) = std::sync::mpsc::channel();

    println!("Starting GPUI in a background thread (headless)...");
    std::thread::spawn(move || {
        println!("Background thread started.");
        let app = gpui_platform::headless();
        app.run(move |cx| {
            println!("GPUI app.run callback executing on separate thread: {:?}", std::thread::current().id());
            
            // 2. Keep the GPUI run loop alive by spawning a never-ending task.
            // This ensures CFRunLoopRun() on this thread doesn't exit due to lack of sources.
            println!("Spawning keep-alive task...");
            cx.spawn(|cx: &mut AsyncApp| {
                let cx = cx.clone();
                async move {
                    loop {
                        cx.background_executor().timer(Duration::from_secs(3600)).await;
                    }
                }
            }).detach();

            println!("Spawning init task...");
            cx.spawn({
                let tx = tx.clone();
                |cx: &mut AsyncApp| {
                    let cx = cx.clone();
                    async move {
                        println!("Async init task started.");
                        // Delay initialization to avoid re-entrancy issues during app.run callback.
                        println!("Waiting 100ms before init...");
                        cx.background_executor().timer(Duration::from_millis(100)).await;
                        
                        println!("Initializing EditorService on GPUI thread...");
                        let editor_tx = vscode_rust_app_lib::editor_service::init_on_main_thread(&cx).await;
                        tx.send(editor_tx).expect("Failed to send editor_tx");
                        
                        println!("Async init task finished.");
                    }
                }
            }).detach();
            println!("GPUI closure finished setup.");
        });
        println!("GPUI app.run returned! This means the run loop exited or never started properly.");
    });

    println!("Tauri starting on main thread...");
    println!("Waiting for editor_tx from GPUI thread...");
    let editor_tx = rx.recv().expect("Failed to receive editor_tx");
    println!("Received editor_tx, launching Tauri...");
    vscode_rust_app_lib::run(editor_tx);
}
