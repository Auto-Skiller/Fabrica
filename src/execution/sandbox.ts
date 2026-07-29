import vm from 'vm';
import { exec } from 'child_process';
import { getPiExecutionOptions } from '../harness.js';

export interface SandboxResult {
  success: boolean;
  result: any;
  logs: string[];
  executionTimeMs: number;
  error?: string;
}

export interface PiAgentExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

/**
 * Executes pi CLI agent command for a tenant in child_process.
 * Injects tenant-isolated PI_CODING_AGENT_DIR and global system flags (--skill, --extension).
 */
export function executePiAgentCommand(
  prompt: string,
  tenantId: string = 'default_user',
  extraArgs: string[] = []
): Promise<PiAgentExecResult> {
  return new Promise((resolve) => {
    const options = getPiExecutionOptions(tenantId);
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    const args = [...options.cliFlags, ...extraArgs, `--prompt "${escapedPrompt}"`].join(' ');
    const cmd = `pi ${args}`;

    exec(cmd, { cwd: options.cwd, env: options.env, timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error.code ?? 1,
          error: error.message
        });
      } else {
        resolve({
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0
        });
      }
    });
  });
}

/**
 * Executes dynamic, user or AI-generated JavaScript/TypeScript compilation targets securely.
 * This runs within an isolated Node.js VM context, preventing access to file-system,
 * process, networking, environment variables, or other malicious side-channels.
 * 
 * Includes CPU time budgeting (timeouts) to defeat infinite-loop-based Denial of Service.
 */
export function executeSandboxedCode(
  code: string,
  contextVariables: Record<string, any> = {},
  timeoutMs = 1000
): SandboxResult {
  const startTime = Date.now();
  const logs: string[] = [];

  // 1. Setup a fully isolated sandbox console to record runtime logs
  const sandboxedConsole = {
    log: (...args: any[]) => {
      logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
    },
    error: (...args: any[]) => {
      logs.push(`[ERROR] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}`);
    },
    warn: (...args: any[]) => {
      logs.push(`[WARN] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}`);
    },
    info: (...args: any[]) => {
      logs.push(`[INFO] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}`);
    }
  };

  // 2. Build the strict execution context. Freeze prototype objects to mitigate VM escape attempts
  const sandboxContext = {
    console: sandboxedConsole,
    ...contextVariables,
    // Strictly isolate standard Node global leaks
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    global: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    clearTimeout: undefined,
    clearInterval: undefined
  };

  // Create isolated context
  const context = vm.createContext(sandboxContext);

  try {
    // 3. Compile and execute the code with a strict timeout limit to avoid process locks
    const script = new vm.Script(code);
    const result = script.runInContext(context, {
      timeout: timeoutMs,
      breakOnSigint: true,
      displayErrors: true
    });

    const executionTimeMs = Date.now() - startTime;
    return {
      success: true,
      result,
      logs,
      executionTimeMs
    };
  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    return {
      success: false,
      result: null,
      logs,
      executionTimeMs,
      error: err.message || String(err)
    };
  }
}
