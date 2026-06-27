use serde_json::Value;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

#[tauri::command]
fn decode_log(log_path: String) -> Result<Value, String> {
    let log_path = normalize_log_path(PathBuf::from(log_path))?;
    let cache_path = cache_path_for_log(&log_path)?;

    if !can_reuse_cache(&cache_path, &log_path) {
        run_backend(vec![
            "decode".into(),
            "--log".into(),
            log_path.display().to_string(),
            "--out".into(),
            cache_path.display().to_string(),
        ])?;
    }

    run_backend(vec![
        "inspect".into(),
        "--cache".into(),
        cache_path.display().to_string(),
    ])
}

#[tauri::command]
fn inspect_cache(cache_path: String) -> Result<Value, String> {
    run_backend(vec!["inspect".into(), "--cache".into(), cache_path])
}

#[tauri::command]
fn query_cache(
    cache_path: String,
    signals: Vec<String>,
    start: f64,
    end: f64,
    max_points_per_signal: u32,
) -> Result<Value, String> {
    let signal_list = signals.join(",");
    run_backend(vec![
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
    ])
}

#[tauri::command]
fn save_png(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create export directory {}: {}", parent.display(), error))?;
    }
    fs::write(&path, bytes).map_err(|error| format!("failed to save PNG {}: {}", path.display(), error))
}

fn run_backend(args: Vec<String>) -> Result<Value, String> {
    let root = repo_root();
    let candidates = backend_command_candidates(&root, args);
    let mut spawn_errors = Vec::new();

    for candidate in candidates {
        let output = match Command::new(&candidate.program)
            .args(&candidate.args)
            .current_dir(&root)
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
        "failed to start backend CLI. Set CAN_LOG_VIEWER_PYTHON to the project venv python, for example .venv/bin/python on macOS/Linux/WSL or .venv\\Scripts\\python.exe on Windows. Details: {}",
        details
    ))
}

struct BackendCommand {
    program: PathBuf,
    args: Vec<String>,
    label: String,
    is_explicit: bool,
}

fn backend_command_candidates(root: &Path, backend_args: Vec<String>) -> Vec<BackendCommand> {
    if let Ok(backend_exe) = env::var("CAN_LOG_VIEWER_BACKEND") {
        let program = resolve_program_path(root, backend_exe);
        return vec![BackendCommand {
            label: program.display().to_string(),
            program,
            args: backend_args,
            is_explicit: true,
        }];
    }

    if let Ok(python) = env::var("CAN_LOG_VIEWER_PYTHON") {
        let program = resolve_program_path(root, python);
        return vec![python_backend_command(program, backend_args, true)];
    }

    vec![
        python_backend_command(PathBuf::from("python3"), backend_args.clone(), false),
        python_backend_command(PathBuf::from("python"), backend_args, false),
    ]
}

fn python_backend_command(program: PathBuf, backend_args: Vec<String>, is_explicit: bool) -> BackendCommand {
    let mut args = vec!["-m".into(), "backend".into()];
    args.extend(backend_args);
    BackendCommand {
        label: program.display().to_string(),
        program,
        args,
        is_explicit,
    }
}

fn resolve_program_path(root: &Path, value: String) -> PathBuf {
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

fn cache_path_for_log(log_path: &Path) -> Result<PathBuf, String> {
    let metadata = fs::metadata(log_path)
        .map_err(|error| format!("failed to read log metadata {}: {}", log_path.display(), error))?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    let cache_key = stable_cache_key(log_path, metadata.len(), modified);
    Ok(repo_root().join("cache").join("logs").join(cache_key))
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
        .invoke_handler(tauri::generate_handler![decode_log, inspect_cache, query_cache, save_png])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
