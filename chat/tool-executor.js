const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Load tool definitions
const toolDefinitions = require('./tools.json');

class ToolExecutor {
    constructor(notesDir, memoryDir) {
        this.notesDir = notesDir;
        this.memoryDir = memoryDir;
        this.tools = toolDefinitions.tools;
    }

    /**
     * Execute a tool call from a model
     */
    async executeTool(toolName, parameters, modelNum, modelName) {
        console.log(`[ToolExecutor] Model ${modelNum} (${modelName}) calling: ${toolName}`);
        console.log(`[ToolExecutor] Parameters:`, parameters);

        const timestamp = new Date().toISOString();
        let result;

        try {
            switch (toolName) {
                case 'note_me':
                    result = await this.handleNoteTo(parameters, modelNum, modelName);
                    break;

                case 'store_memory':
                    result = await this.handleStoreMemory(parameters, modelNum, modelName);
                    break;

                case 'plan_next_action':
                    result = await this.handlePlanNextAction(parameters, modelNum, modelName);
                    break;

                case 'send_to_self':
                    result = await this.handleSendToSelf(parameters, modelNum, modelName);
                    break;

                case 'execute_command':
                    result = await this.handleExecuteCommand(parameters, modelNum, modelName);
                    break;

                case 'list_my_tools':
                    result = await this.handleListTools(parameters);
                    break;

                case 'read_my_notes':
                    result = await this.handleReadNotes(parameters, modelNum);
                    break;

                case 'read_my_memory':
                    result = await this.handleReadMemory(parameters, modelNum);
                    break;

                case 'write_file':
                    result = await this.handleWriteFile(parameters, modelNum);
                    break;

                case 'read_file':
                    result = await this.handleReadFile(parameters);
                    break;

                default:
                    result = {
                        success: false,
                        error: `Unknown tool: ${toolName}`
                    };
            }

            // Log tool execution
            const logEntry = `[${timestamp}] Model ${modelNum} (${modelName})
Tool: ${toolName}
Parameters: ${JSON.stringify(parameters, null, 2)}
Result: ${JSON.stringify(result, null, 2)}
---

`;
            const logFile = path.join(this.notesDir, `tool_calls_model${modelNum}.txt`);
            await fs.appendFile(logFile, logEntry);

            return {
                success: true,
                toolName,
                result,
                timestamp
            };

        } catch (error) {
            console.error(`[ToolExecutor] Error executing ${toolName}:`, error);
            return {
                success: false,
                toolName,
                error: error.message,
                timestamp
            };
        }
    }

    async handleNoteTo(params, modelNum, modelName) {
        const timestamp = new Date().toISOString();
        const note = {
            content: params.content,
            priority: params.priority,
            context: params.context || '',
            timestamp
        };

        const filename = `note_model${modelNum}_${Date.now()}.txt`;
        const filePath = path.join(this.notesDir, filename);

        const content = `[${timestamp}] ${modelName}
Priority: ${params.priority}
Content: ${params.content}
${params.context ? `Context: ${params.context}` : ''}
`;

        await fs.writeFile(filePath, content);

        return {
            success: true,
            message: 'Note saved',
            filename,
            note
        };
    }

    async handleStoreMemory(params, modelNum, modelName) {
        const timestamp = new Date().toISOString();
        const memory = {
            key: params.key,
            value: params.value,
            type: params.type,
            importance: params.importance || 5,
            timestamp
        };

        const filename = params.type === 'long_term'
            ? `long_term_model${modelNum}.txt`
            : `short_term_model${modelNum}.txt`;

        const filePath = path.join(this.memoryDir, filename);

        const content = `[${timestamp}] ${modelName}
Key: ${params.key}
Value: ${params.value}
Type: ${params.type}
Importance: ${memory.importance}
---

`;

        await fs.appendFile(filePath, content);

        return {
            success: true,
            message: 'Memory stored',
            memory
        };
    }

    async handlePlanNextAction(params, modelNum, modelName) {
        const timestamp = new Date().toISOString();
        const action = {
            action: params.action,
            reasoning: params.reasoning,
            self_prompt: params.self_prompt,
            timestamp
        };

        const filename = `actions_model${modelNum}.txt`;
        const filePath = path.join(this.notesDir, filename);

        const content = `[${timestamp}] ${modelName}
Action: ${params.action}
Reasoning: ${params.reasoning}
Self-Prompt: ${params.self_prompt || '(none - ending turn)'}
---

`;

        await fs.appendFile(filePath, content);

        return {
            success: true,
            message: 'Action planned',
            action,
            will_continue: !!params.self_prompt,
            self_prompt: params.self_prompt
        };
    }

    async handleSendToSelf(params, modelNum, modelName) {
        const timestamp = new Date().toISOString();

        const filename = `self_messages_model${modelNum}.txt`;
        const filePath = path.join(this.notesDir, filename);

        const content = `[${timestamp}] ${modelName} -> Self
Message: ${params.message}
Context: ${params.context || '(none)'}
---

`;

        await fs.appendFile(filePath, content);

        return {
            success: true,
            message: 'Message sent to self',
            self_message: params.message,
            will_process: true
        };
    }

    async handleExecuteCommand(params, modelNum, modelName) {
        const timestamp = new Date().toISOString();

        // Safety check - restrict dangerous commands
        const dangerousPatterns = [
            /rm\s+-rf\s+\//, // rm -rf /
            /mkfs/,           // format filesystem
            /dd\s+if=/,       // disk operations
            /:(){ :|:& };:/   // fork bomb
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(params.command)) {
                return {
                    success: false,
                    error: 'Command blocked for safety',
                    command: params.command
                };
            }
        }

        try {
            const options = {
                timeout: 30000, // 30 second timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            };

            if (params.working_directory) {
                options.cwd = params.working_directory;
            }

            const { stdout, stderr } = await execPromise(params.command, options);

            // Log command execution
            const logFile = path.join(this.notesDir, `commands_model${modelNum}.txt`);
            const logEntry = `[${timestamp}] ${modelName}
Command: ${params.command}
Reason: ${params.reason}
Working Dir: ${params.working_directory || process.cwd()}
Exit: Success
Stdout: ${stdout}
Stderr: ${stderr}
---

`;
            await fs.appendFile(logFile, logEntry);

            return {
                success: true,
                command: params.command,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exit_code: 0
            };

        } catch (error) {
            const logFile = path.join(this.notesDir, `commands_model${modelNum}.txt`);
            const logEntry = `[${timestamp}] ${modelName}
Command: ${params.command}
Reason: ${params.reason}
Exit: Failed
Error: ${error.message}
---

`;
            await fs.appendFile(logFile, logEntry);

            return {
                success: false,
                command: params.command,
                error: error.message,
                stdout: error.stdout?.trim() || '',
                stderr: error.stderr?.trim() || '',
                exit_code: error.code || 1
            };
        }
    }

    async handleListTools(params) {
        const category = params.category || 'all';

        if (category === 'all') {
            return {
                success: true,
                tools: this.tools,
                categories: toolDefinitions.tool_categories,
                system_prompt: toolDefinitions.system_prompt
            };
        }

        const toolNames = toolDefinitions.tool_categories[category] || [];
        const filteredTools = this.tools.filter(t => toolNames.includes(t.name));

        return {
            success: true,
            category,
            tools: filteredTools
        };
    }

    async handleReadNotes(params, modelNum) {
        try {
            const files = await fs.readdir(this.notesDir);
            const noteFiles = files.filter(f =>
                f.startsWith(`note_model${modelNum}`) ||
                f === `actions_model${modelNum}.txt` ||
                f === `self_messages_model${modelNum}.txt`
            );

            const notes = [];
            const limit = params.limit || 10;

            for (const file of noteFiles.slice(-limit)) {
                const filePath = path.join(this.notesDir, file);
                const content = await fs.readFile(filePath, 'utf-8');

                if (!params.filter || content.includes(params.filter)) {
                    notes.push({
                        filename: file,
                        content: content
                    });
                }
            }

            return {
                success: true,
                notes,
                count: notes.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                notes: []
            };
        }
    }

    async handleReadMemory(params, modelNum) {
        try {
            const memories = [];
            const types = params.type === 'all' ? ['short_term', 'long_term'] : [params.type || 'all'];

            if (types.includes('all')) {
                types.push('short_term', 'long_term');
                types.splice(types.indexOf('all'), 1);
            }

            for (const type of types) {
                const filename = `${type}_model${modelNum}.txt`;
                const filePath = path.join(this.memoryDir, filename);

                try {
                    const content = await fs.readFile(filePath, 'utf-8');

                    if (params.key) {
                        // Filter by key
                        const entries = content.split('---\n').filter(e => e.includes(`Key: ${params.key}`));
                        if (entries.length > 0) {
                            memories.push({
                                type,
                                content: entries.join('\n---\n')
                            });
                        }
                    } else {
                        memories.push({
                            type,
                            content
                        });
                    }
                } catch (err) {
                    // File doesn't exist yet, skip
                    continue;
                }
            }

            return {
                success: true,
                memories,
                count: memories.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                memories: []
            };
        }
    }

    async handleWriteFile(params, modelNum) {
        const mode = params.mode || 'write';

        try {
            if (mode === 'append') {
                await fs.appendFile(params.path, params.content);
            } else {
                await fs.writeFile(params.path, params.content);
            }

            return {
                success: true,
                path: params.path,
                mode,
                bytes_written: params.content.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: params.path
            };
        }
    }

    async handleReadFile(params) {
        try {
            const content = await fs.readFile(params.path, 'utf-8');

            return {
                success: true,
                path: params.path,
                content,
                size: content.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: params.path
            };
        }
    }
}

module.exports = ToolExecutor;
