pub mod commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[derive(Clone)]
pub struct AppState {
    pub close_to_tray: Arc<AtomicBool>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("مرحباً {}! أهلاً بك في ديوان", name)
}

#[tauri::command]
fn set_close_to_tray(state: tauri::State<AppState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn hide_to_tray(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn show_from_tray(window: tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        close_to_tray: Arc::new(AtomicBool::new(true)),
    };

    let close_to_tray_state = app_state.close_to_tray.clone();

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Build System Tray Menu
            let show_item = MenuItem::with_id(app, "show", "إظهار ديوان", true, None::<&str>)?;
            let play_pause_item =
                MenuItem::with_id(app, "play_pause", "تشغيل / إيقاف مؤقت", true, None::<&str>)?;
            let next_item = MenuItem::with_id(app, "next", "القصيدة التالية", true, None::<&str>)?;
            let prev_item = MenuItem::with_id(app, "prev", "القصيدة السابقة", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "إغلاق التطبيق نهائياً", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &play_pause_item,
                    &next_item,
                    &prev_item,
                    &quit_item,
                ],
            )?;

            let tray_icon = app.default_window_icon().cloned();
            if let Some(icon) = tray_icon {
                let _tray = TrayIconBuilder::new()
                    .icon(icon)
                    .menu(&menu)
                    .tooltip("ديوان — الشعر العربي والمحاذاة الصوتية")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "play_pause" => {
                            let _ = app.emit("tray-toggle-playback", ());
                        }
                        "next" => {
                            let _ = app.emit("tray-next-track", ());
                        }
                        "prev" => {
                            let _ = app.emit("tray-previous-track", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Background play mode (like Telegram): intercept window close, keep playing audio, hide to tray
                if close_to_tray_state.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            set_close_to_tray,
            hide_to_tray,
            show_from_tray,
            exit_app,
            commands::worker::execute_worker_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
