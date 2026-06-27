use chrono::Local;
use serde_json::Value;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

#[tauri::command]
fn decode_log(app: AppHandle, log_path: String) -> Result<Value, String> {
    let log_path = normalize_log_path(PathBuf::from(log_path))?;
    let app_root = app_data_root(&app)?;
    let cache_path = cache_path_for_log(&app_root, &log_path)?;

    if !can_reuse_cache(&cache_path, &log_path) {
        run_backend(
            &app,
            vec![
                "decode".into(),
                "--log".into(),
                log_path.display().to_string(),
                "--out".into(),
                cache_path.display().to_string(),
            ],
        )?;
    }

    run_backend(
        &app,
        vec![
            "inspect".into(),
            "--cache".into(),
            cache_path.display().to_string(),
        ],
    )
}

#[tauri::command]
fn inspect_cache(app: AppHandle, cache_path: String) -> Result<Value, String> {
    run_backend(&app, vec!["inspect".into(), "--cache".into(), cache_path])
}

#[tauri::command]
fn query_cache(
    app: AppHandle,
    cache_path: String,
    signals: Vec<String>,
    start: f64,
    end: f64,
    max_points_per_signal: u32,
) -> Result<Value, String> {
    let signal_list = signals.join(",");
    run_backend(
        &app,
        vec![
            "query".into(),
            "--cache".into(),
            cache_path,
            "--signals".into(),
            signal_list,
            "--start".into(),
            start.to_string(),
            "--end".into(),
            end.to_string(),
            "--max-points-per-signal".into(),
            max_points_per_signal.to_string(),
        ],
    )
}

// Export a timeline PNG into the app-managed exports/png directory. The frontend
// only supplies the rendered bytes and the opened log's name; this command owns
// the output location and the file name (sanitize + timestamp + collision
// suffix) so the user is never asked to choose a destination. Returns the saved
// file name (not the full path) for a brief status message.
#[tauri::command]
fn export_timeline_png(
    app: AppHandle,
    log_file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let app_root = app_data_root(&app)?;
    let dir = export_png_dir(&app_root);
    fs::create_dir_all(&dir).map_err(|error| {
        format!(
            "failed to create export directory {}: {}",
            dir.display(),
            error
        )
    })?;

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let stem = sanitize_filename(file_stem(&log_file_name));
    let base = if stem.is_empty() {
        // Fallback when the log basename is unavailable / fully sanitized away.
        format!("timeline_{timestamp}")
    } else {
        format!("{stem}_{timestamp}_timeline")
    };

    let path = unique_export_path(&dir, &base);
    fs::write(&path, bytes)
        .map_err(|error| format!("failed to save PNG {}: {}", path.display(), error))?;

    Ok(path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or(base))
}

fn export_png_dir(app_root: &Path) -> PathBuf {
    app_root.join("exports").join("png")
}

fn file_stem(log_file_name: &str) -> String {
    Path::new(log_file_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("")
        .to_string()
}

// Replace characters that are unsafe in file names across platforms, collapse
// whitespace to underscores, and trim stray edge underscores.
fn sanitize_filename(value: String) -> String {
    value
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other if other.is_whitespace() || other.is_control() => '_',
            other => other,
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

// Pick a non-existing path: `<base>.png`, then `<base>_001.png`, etc. Existing
// files are never overwritten.
fn unique_export_path(dir: &Path, base: &str) -> PathBuf {
    let first = dir.join(format!("{base}.png"));
    if !first.exists() {
        return first;
    }
    let mut suffix = 1u32;
    loop {
        let candidate = dir.join(format!("{base}_{suffix:03}.png"));
        if !candidate.exists() {
            return candidate;
        }
        suffix += 1;
    }
}

fn run_backend(app: &AppHandle, args: Vec<String>) -> Result<Value, String> {
    let candidates = backend_command_candidates(app, &args)?;
    let mut spawn_errors = Vec::new();

    for candidate in candidates {
        let output = match Command::new(&candidate.program)
            .args(&candidate.args)
            .current_dir(&candidate.working_dir)
            .output()
        {
            Ok(output) => output,
            Err(error) => {
                spawn_errors.push(format!("{}: {}", candidate.label, error));
                if candidate.is_explicit {
                    break;
                }
                continue;
            }
        };

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if !output.status.success() {
            let detail = if stderr.is_empty() { stdout } else { stderr };
            return Err(if detail.is_empty() {
                format!(
                    "backend CLI failed via {} with status {}",
                    candidate.label, output.status
                )
            } else {
                format!(
                    "backend CLI failed via {} with status {}: {}",
                    candidate.label, output.status, detail
                )
            });
        }

        return serde_json::from_slice(&output.stdout).map_err(|error| {
            let stderr_detail = if stderr.is_empty() {
                "no stderr".to_string()
            } else {
                stderr
            };
            format!(
                "backend returned invalid JSON via {}: {}. stderr: {}",
                candidate.label, error, stderr_detail
            )
        });
    }

    let details = if spawn_errors.is_empty() {
        "no backend command candidates were available".to_string()
    } else {
        spawn_errors.join("; ")
    };
    Err(format!(
        "failed to start backend CLI. Set CAN_LOG_VIEWER_BACKEND to a backend executable path, or in development set CAN_LOG_VIEWER_PYTHON to the project venv python. Details: {}",
        details
    ))
}

struct BackendCommand {
    program: PathBuf,
    args: Vec<String>,
    working_dir: PathBuf,
    label: String,
    is_explicit: bool,
}

fn backend_command_candidates(
    app: &AppHandle,
    backend_args: &[String],
) -> Result<Vec<BackendCommand>, String> {
    let safe_working_dir = app_data_root(app)?;

    if let Ok(backend_exe) = env::var("CAN_LOG_VIEWER_BACKEND") {
        let program = resolve_env_backend_path(backend_exe);
        return Ok(vec![BackendCommand {
            label: program.display().to_string(),
            program,
            args: backend_args.to_vec(),
            working_dir: safe_working_dir,
            is_explicit: true,
        }]);
    }

    let mut candidates = Vec::new();
    if let Some(program) = bundled_backend_path(app) {
        candidates.push(BackendCommand {
            label: format!("bundled sidecar {}", program.display()),
            program,
            args: backend_args.to_vec(),
            working_dir: safe_working_dir.clone(),
            is_explicit: false,
        });
    }

    #[cfg(debug_assertions)]
    candidates.extend(development_python_backend_candidates(backend_args));

    Ok(candidates)
}

#[cfg(debug_assertions)]
fn development_python_backend_candidates(backend_args: &[String]) -> Vec<BackendCommand> {
    let root = repo_root();
    if let Ok(python) = env::var("CAN_LOG_VIEWER_PYTHON") {
        let program = resolve_program_path(root, python);
        return vec![python_backend_command(program, backend_args.to_vec(), true)];
    }

    vec![
        python_backend_command(PathBuf::from("python3"), backend_args.to_vec(), false),
        python_backend_command(PathBuf::from("python"), backend_args.to_vec(), false),
    ]
}

#[cfg(debug_assertions)]
fn python_backend_command(
    program: PathBuf,
    backend_args: Vec<String>,
    is_explicit: bool,
) -> BackendCommand {
    let mut args = vec!["-m".into(), "backend".into()];
    args.extend(backend_args);
    BackendCommand {
        label: program.display().to_string(),
        program,
        args,
        working_dir: repo_root(),
        is_explicit,
    }
}

fn bundled_backend_path(app: &AppHandle) -> Option<PathBuf> {
    let executable_name = backend_executable_name();
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(executable_name));
    }
    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join(executable_name));
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

fn backend_executable_name() -> &'static str {
    if cfg!(windows) {
        "can-log-viewer-backend.exe"
    } else {
        "can-log-viewer-backend"
    }
}

fn resolve_env_backend_path(value: String) -> PathBuf {
    let path = PathBuf::from(value);
    if path.is_absolute() {
        return path;
    }

    let root = if cfg!(debug_assertions) {
        repo_root()
    } else {
        env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("."))
    };
    root.join(path)
}

#[cfg(debug_assertions)]
fn resolve_program_path(root: PathBuf, value: String) -> PathBuf {
    let path = PathBuf::from(value);
    if path.is_absolute() {
        path
    } else {
        root.join(path)
    }
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

// Single source of truth for the writable, app-managed root. Both the decode
// cache (cache/) and PNG exports (exports/png/) live under here. By default this
// is Tauri's OS app data directory. Developers can override it with
// CAN_LOG_VIEWER_APP_DATA_ROOT for reproducible local smoke checks.
fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = if let Ok(value) = env::var("CAN_LOG_VIEWER_APP_DATA_ROOT") {
        let path = PathBuf::from(value);
        if path.is_absolute() {
            path
        } else {
            env::current_dir()
                .unwrap_or_else(|_| repo_root())
                .join(path)
        }
    } else {
        app.path()
            .app_data_dir()
            .map_err(|error| format!("failed to resolve app data directory: {error}"))?
    };

    fs::create_dir_all(&root).map_err(|error| {
        format!(
            "failed to create app data directory {}: {}",
            root.display(),
            error
        )
    })?;
    Ok(root)
}

fn normalize_log_path(path: PathBuf) -> Result<PathBuf, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "blf" | "asc" | "csv") {
        return Err("Open Log expects a .blf, .asc, or .csv file".into());
    }
    path.canonicalize()
        .map_err(|error| format!("failed to access log file {}: {}", path.display(), error))
}

fn cache_path_for_log(app_root: &Path, log_path: &Path) -> Result<PathBuf, String> {
    let metadata = fs::metadata(log_path).map_err(|error| {
        format!(
            "failed to read log metadata {}: {}",
            log_path.display(),
            error
        )
    })?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    let cache_key = stable_cache_key(log_path, metadata.len(), modified);
    Ok(app_root.join("cache").join("logs").join(cache_key))
}

fn can_reuse_cache(cache_path: &Path, log_path: &Path) -> bool {
    let required = [
        cache_path.join("meta.json"),
        cache_path.join("decoded_signals.parquet"),
        cache_path.join("signal_index.json"),
        cache_path.join("warnings.json"),
    ];
    if required.iter().any(|path| !path.exists()) {
        return false;
    }

    let Ok(meta_text) = fs::read_to_string(cache_path.join("meta.json")) else {
        return false;
    };
    let Ok(meta) = serde_json::from_str::<Value>(&meta_text) else {
        return false;
    };
    let Some(logs) = meta.get("logs").and_then(Value::as_array) else {
        return false;
    };
    let expected = log_path.display().to_string();
    logs.len() == 1 && logs[0].as_str() == Some(expected.as_str())
}

fn stable_cache_key(log_path: &Path, size: u64, modified: u128) -> String {
    let input = format!("{}|{}|{}", log_path.display(), size, modified);
    let mut hash = 0xcbf29ce484222325u64;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            decode_log,
            inspect_cache,
            query_cache,
            export_timeline_png
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
