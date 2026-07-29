import { executeSandboxedCode } from '../../src/execution/sandbox.js';

/**
 * Fabrica Secure VM Code Evaluation Extension for pi agent
 * Provides the `vm_eval` tool directly to the agent in interactive sessions.
 */
export default function vmEvalToolExtension(pi) {
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
    execute: async ({ code, timeoutMs }) => {
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
      } catch (err) {
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
