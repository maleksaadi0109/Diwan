import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const command = isWindows ? "tauri.cmd" : "tauri";
const env = { ...process.env };

// WebKitGTK uses this workaround on Linux. Windows and macOS do not need it.
if (process.platform === "linux") {
  env.WEBKIT_DISABLE_DMABUF_RENDERER = "1";
}

const child = spawn(command, ["dev"], {
  env,
  stdio: "inherit",
  // Windows .cmd shims require cmd.exe to launch through Node.
  shell: isWindows,
});

child.on("error", (error) => {
  console.error(`Failed to start Tauri: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Tauri stopped because of signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});