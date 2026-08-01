import vm from 'vm';
import { exec } from 'child_process';
import { getPiExecutionOptions } from './harness.js';

// ── Co-Located TypeScript Interfaces ──────────────────────────────────────────

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

export interface VmEvalToolOptions {
  code: string;
  timeoutMs?: number;
}

// ── V8 VM Sandbox Execution Engine ────────────────────────────────────────────

export function executeSandboxedCode(
  code: string,
  contextVariables: Record<string, any> = {},
  timeoutMs = 1000
): SandboxResult {
  const startTime = Date.now();
  const logs: string[] = [];

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

  const sandboxContext = {
    console: sandboxedConsole,
    ...contextVariables,
    process: undefined,
    require: undefined,
    import: undefined,
    module: undefined,
    exports: undefined,
    global: undefined,
    globalThis: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    WebSocket: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    clearTimeout: undefined,
    clearInterval: undefined
  };

  const context = vm.createContext(sandboxContext);

  // Freeze global prototypes in the VM context to prevent prototype pollution escapes
  try {
    vm.runInContext(`
      Object.freeze(Object.prototype);
      Object.freeze(Array.prototype);
      Object.freeze(Function.prototype);
      Object.freeze(String.prototype);
      Object.freeze(Number.prototype);
      Object.freeze(Boolean.prototype);
    `, context);
  } catch (_) {}

  try {
    let codeToRun = code;
    if (/^\s*return\b/.test(codeToRun) || (/return\b/.test(codeToRun) && !/function\b/.test(codeToRun))) {
      codeToRun = `(function() { ${codeToRun} })()`;
    }
    const script = new vm.Script(codeToRun);
    const result = script.runInContext(context, {
      timeout: timeoutMs || 1000,
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

// VM Eval Tool Registration Helper
export function registerVmEvalTool(pi: any) {
  if (!pi) return;

  const toolDefinition = {
    name: 'vm_eval',
    description: 'Executes JavaScript code in an isolated V8 Node.js VM context with frozen prototypes, disabled process/network bindings, and strict CPU execution timeout.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code snippet to execute inside the isolated V8 sandbox'
        },
        timeoutMs: {
          type: 'number',
          description: 'Maximum execution timeout in milliseconds (default: 1000)'
        }
      },
      required: ['code']
    },
    execute: async ({ code, timeoutMs }: VmEvalToolOptions) => {
      try {
        const result = executeSandboxedCode(code, {}, timeoutMs || 1000);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: err.message }, null, 2)
            }
          ]
        };
      }
    }
  };

  if (typeof pi.registerTool === 'function') {
    pi.registerTool(toolDefinition);
  } else if (typeof pi.addTool === 'function') {
    pi.addTool(toolDefinition);
  }
}
