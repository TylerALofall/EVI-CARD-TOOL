# How Models Use Tools, Message Themselves, and Run Commands

This guide explains how AI models in this system can:
1. **See their available tools** (tool menu)
2. **Message themselves** (self-prompting)
3. **Execute commands**
4. **Manage their own memory and notes**

---

## Table of Contents

1. [Tool Architecture](#tool-architecture)
2. [Available Tools](#available-tools)
3. [How Models See Their Tools](#how-models-see-their-tools)
4. [Self-Messaging Mechanism](#self-messaging-mechanism)
5. [Command Execution](#command-execution)
6. [Integration with AI Models](#integration-with-ai-models)
7. [Testing Tools](#testing-tools)

---

## Tool Architecture

The system provides **10 tools** that models can use:

```
┌─────────────────────────────────────┐
│         AI Model                    │
│  (OpenAI, Claude, etc.)             │
└─────────────┬───────────────────────┘
              │
              │ Tool Calls
              │
              ▼
┌─────────────────────────────────────┐
│      Tool Executor                  │
│  - Validates calls                  │
│  - Executes tools                   │
│  - Saves results                    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      File System                    │
│  - notes/                           │
│  - memory/                          │
│  - exports/                         │
└─────────────────────────────────────┘
```

---

## Available Tools

### 1. Memory & Notes

#### `note_me`
Write internal notes to yourself.

```json
{
  "name": "note_me",
  "parameters": {
    "content": "My thought about this conversation...",
    "priority": "high"
  }
}
```

**Saved to:** `notes/note_model1_<timestamp>.txt`

#### `store_memory`
Store short-term or long-term memories.

```json
{
  "name": "store_memory",
  "parameters": {
    "key": "user_preference",
    "value": "The user prefers detailed explanations",
    "type": "long_term",
    "importance": 8
  }
}
```

**Saved to:** `memory/long_term_model1.txt` or `memory/short_term_model1.txt`

#### `read_my_notes`
Read your previous notes.

```json
{
  "name": "read_my_notes",
  "parameters": {
    "filter": "conversation",
    "limit": 5
  }
}
```

#### `read_my_memory`
Retrieve stored memories.

```json
{
  "name": "read_my_memory",
  "parameters": {
    "type": "long_term",
    "limit": 10
  }
}
```

---

### 2. Self-Messaging

#### `send_to_self`
Send a message directly to yourself to continue reasoning.

```json
{
  "name": "send_to_self",
  "parameters": {
    "message": "I should reconsider my approach to this problem. Let me think about edge cases...",
    "context": "Reconsidering solution approach"
  }
}
```

**Effect:** Your message is immediately fed back to you as a new prompt, allowing you to continue your turn.

**Saved to:** `notes/self_messages_model1.txt`

#### `plan_next_action`
Plan your next action and optionally self-prompt.

```json
{
  "name": "plan_next_action",
  "parameters": {
    "action": "analyze_code_structure",
    "reasoning": "Need to understand the codebase before suggesting changes",
    "self_prompt": "Now that I've planned to analyze the code, let me actually read the files and look for patterns..."
  }
}
```

**Effect:** If `self_prompt` is not empty, it's sent back to you automatically.

**Saved to:** `notes/actions_model1.txt` and `notes/self_prompts_model1.txt`

---

### 3. Command Execution

#### `execute_command`
Run shell commands.

```json
{
  "name": "execute_command",
  "parameters": {
    "command": "ls -la notes/",
    "reason": "I need to see what notes I've created",
    "working_directory": "/path/to/chat"
  }
}
```

**Returns:**
```json
{
  "success": true,
  "stdout": "note_model1_123.txt\nnote_model1_124.txt",
  "stderr": "",
  "exit_code": 0
}
```

**Safety:** Dangerous commands like `rm -rf /` are blocked.

**Saved to:** `notes/commands_model1.txt`

---

### 4. File Operations

#### `write_file`
Write content to a file.

```json
{
  "name": "write_file",
  "parameters": {
    "path": "/path/to/output.txt",
    "content": "My analysis results...",
    "mode": "write"
  }
}
```

**Mode:** `write` (overwrite) or `append`

#### `read_file`
Read content from a file.

```json
{
  "name": "read_file",
  "parameters": {
    "path": "/path/to/input.txt"
  }
}
```

---

### 5. Tool Discovery

#### `list_my_tools`
Get a list of all available tools.

```json
{
  "name": "list_my_tools",
  "parameters": {
    "category": "all"
  }
}
```

**Categories:** `all`, `memory`, `communication`, `execution`, `planning`

**Returns:** Complete tool definitions with parameters and descriptions.

---

## How Models See Their Tools

### Method 1: System Prompt

When you integrate with an AI model, include this in the system prompt:

```
You have access to a set of tools that allow you to:
1. Take notes and store memories
2. Send messages to yourself to continue reasoning
3. Execute commands and interact with files
4. Plan your actions and self-prompt

Use 'list_my_tools' to see all available tools at any time.
Use 'send_to_self' to continue your turn and keep thinking.
```

### Method 2: Function Calling (OpenAI/Claude)

Define tools as functions:

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "send_to_self",
      description: "Send a message to yourself to continue thinking",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
          context: { type: "string" }
        },
        required: ["message"]
      }
    }
  },
  // ... more tools
];

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: messages,
  tools: tools
});
```

### Method 3: API Endpoint

Models can call `GET /tools` to see available tools:

```bash
curl http://localhost:3000/tools
```

Response:
```json
{
  "success": true,
  "tools": [...],
  "categories": {...},
  "system_prompt": "..."
}
```

---

## Self-Messaging Mechanism

### How It Works

1. **Model decides to self-prompt:**
   ```json
   {
     "tool": "send_to_self",
     "parameters": {
       "message": "Let me reconsider this..."
     }
   }
   ```

2. **Backend saves the message:**
   - Writes to `notes/self_messages_model1.txt`
   - Returns success

3. **Frontend (or your integration) sends it back:**
   ```javascript
   if (result.will_process && result.self_message) {
     // Send the self_message back to the model as a new user message
     await sendToModel(result.self_message, modelNum);
   }
   ```

4. **Model receives its own message and continues**

### Example Flow

```
User: "How should I structure my code?"

Model (thinking):
  - Calls note_me: "User asking about code structure"
  - Calls send_to_self: "Let me first understand what type of project this is..."

  [Self-message is fed back]

Model (continuing):
  - Receives own message: "Let me first understand..."
  - Responds: "What type of project are you building?"
  - Calls send_to_self: "I should also consider best practices..."

  [Self-message is fed back]

Model (continuing):
  - Receives: "I should also consider best practices..."
  - Provides detailed answer with best practices
  - Calls plan_next_action with empty self_prompt (stops)
```

---

## Command Execution

### Running Commands

Models can execute shell commands using `execute_command`:

```json
{
  "name": "execute_command",
  "parameters": {
    "command": "node my-script.js",
    "reason": "Need to run the analysis script"
  }
}
```

### Safety Restrictions

These commands are **blocked**:
- `rm -rf /` - Dangerous deletions
- `mkfs` - Filesystem formatting
- `dd if=` - Disk operations
- Fork bombs

### Timeout

Commands timeout after **30 seconds**.

### Working Directory

Specify where to run:
```json
{
  "command": "npm install",
  "working_directory": "/path/to/project"
}
```

---

## Integration with AI Models

### OpenAI Example

```javascript
const { OpenAI } = require('openai');
const openai = new OpenAI();

// Load tools
const toolsData = require('./tools.json');

async function chat(userMessage, modelNum) {
  const messages = [
    {
      role: "system",
      content: toolsData.system_prompt
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  // Convert tool definitions to OpenAI format
  const tools = toolsData.tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));

  // Call OpenAI
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    tools: tools
  });

  // Handle tool calls
  if (response.choices[0].message.tool_calls) {
    for (const toolCall of response.choices[0].message.tool_calls) {
      const toolName = toolCall.function.name;
      const params = JSON.parse(toolCall.function.arguments);

      // Execute tool via our API
      const result = await fetch('http://localhost:3000/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          parameters: params,
          modelNum,
          modelName: 'GPT-4'
        })
      });

      const toolResult = await result.json();

      // If it's a self-message, feed it back
      if (toolName === 'send_to_self' && toolResult.result?.self_message) {
        messages.push({
          role: "user",
          content: `[Your own message to yourself]: ${toolResult.result.self_message}`
        });

        // Continue the conversation
        return chat(messages, modelNum);
      }
    }
  }

  return response.choices[0].message.content;
}
```

### Claude Example

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

const toolsData = require('./tools.json');

async function chat(userMessage, modelNum) {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    tools: toolsData.tools, // Claude uses same format!
    messages: [
      {
        role: "user",
        content: userMessage
      }
    ]
  });

  // Handle tool use
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      // Execute tool
      const result = await fetch('http://localhost:3000/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: block.name,
          parameters: block.input,
          modelNum,
          modelName: 'Claude'
        })
      });

      const toolResult = await result.json();

      // Handle self-prompting
      if (block.name === 'send_to_self' && toolResult.result?.self_message) {
        // Continue conversation with self-message
        // ...
      }
    }
  }
}
```

---

## Testing Tools

### Web Interface

Open `tools-demo.html` in your browser:

```
http://localhost:3000/tools-demo.html
```

This interface lets you:
- See all available tools
- Test each tool with different parameters
- View results in real-time
- Switch between Model 1 and Model 2

### Command Line Testing

```bash
# List tools
curl http://localhost:3000/tools

# Execute a tool
curl -X POST http://localhost:3000/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "note_me",
    "parameters": {
      "content": "Testing from command line",
      "priority": "low"
    },
    "modelNum": 1,
    "modelName": "Test"
  }'

# Send to self
curl -X POST http://localhost:3000/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "send_to_self",
    "parameters": {
      "message": "I should test all my tools!",
      "context": "Testing"
    },
    "modelNum": 1,
    "modelName": "Test"
  }'

# Execute command
curl -X POST http://localhost:3000/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "execute_command",
    "parameters": {
      "command": "echo Hello from AI model!",
      "reason": "Testing command execution"
    },
    "modelNum": 1,
    "modelName": "Test"
  }'
```

---

## Best Practices

### For Models

1. **Always call `list_my_tools` first** to see what's available
2. **Use `note_me`** to track your thinking process
3. **Use `send_to_self`** when you need to continue reasoning
4. **Store important context** in `long_term` memory
5. **Read your notes and memory** before making decisions
6. **Plan actions** before executing commands
7. **Use structured outputs** (note_me, memory, next_action) after each response

### For Developers

1. **Include tool definitions** in system prompts
2. **Handle self-prompting** by feeding messages back
3. **Log all tool calls** for debugging
4. **Set appropriate timeouts** for command execution
5. **Validate tool parameters** before execution
6. **Monitor file sizes** to prevent disk issues

---

## File Organization

After models use tools, files are organized:

```
chat/
├── notes/
│   ├── note_model1_<timestamp>.txt       # Individual notes
│   ├── actions_model1.txt                # All planned actions
│   ├── self_messages_model1.txt          # Self-prompts
│   ├── self_prompts_model1.txt           # From next_action
│   ├── commands_model1.txt               # Command history
│   └── tool_calls_model1.txt             # All tool executions
├── memory/
│   ├── short_term_model1.txt             # Short-term memories
│   └── long_term_model1.txt              # Long-term memories
└── exports/
    └── chat_export_<timestamp>.json      # Full exports
```

---

## Troubleshooting

**Tool not found:**
- Check tool name spelling
- Call `list_my_tools` to see available tools

**Permission denied:**
- Check file paths
- Ensure directories exist
- Verify write permissions

**Command blocked:**
- Review safety restrictions
- Use safer alternatives
- Check command syntax

**Self-prompting not working:**
- Ensure `send_to_self` result is fed back to model
- Check that `self_prompt` field is not empty
- Verify message routing logic

---

## Summary

Models can:
- ✅ See all available tools via `list_my_tools` or system prompt
- ✅ Message themselves via `send_to_self` and `plan_next_action`
- ✅ Execute commands via `execute_command` (with safety limits)
- ✅ Manage their own memory and notes
- ✅ Read their previous thoughts and decisions
- ✅ Continue their turn indefinitely through self-prompting

This creates a powerful system where AI models can **think**, **remember**, **act**, and **continue reasoning** autonomously!

---

For integration examples, see `INTEGRATION.md`.
For API documentation, see the server endpoints in `server.js`.
For testing, use `tools-demo.html`.
