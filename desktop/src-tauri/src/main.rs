// CareerPilot desktop: a window around the web app, plus the bundled Python backend
// (careerpilot-server) started on 127.0.0.1 when the app opens and stopped when it closes.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// Must match VITE_API_BASE in the desktop frontend build and the CSP in tauri.conf.json.
const BACKEND_PORT: &str = "8765";

struct Backend(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        // A second launch focuses the open window instead of starting a second backend.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // %APPDATA%\app.careerpilot.desktop: database, CVs, .env and logs live here.
            let home = app.path().app_data_dir()?;
            std::fs::create_dir_all(&home)?;
            let (_events, child) = app
                .shell()
                .sidecar("careerpilot-server")?
                .env("CAREERPILOT_HOME", home.to_string_lossy().to_string())
                .env("CAREERPILOT_PORT", BACKEND_PORT)
                // The backend exits by itself if this app goes away (even after a crash).
                .env("CAREERPILOT_PARENT_PID", std::process::id().to_string())
                .spawn()?;
            app.manage(Backend(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while starting CareerPilot")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app.state::<Backend>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
