# Floating Glass Dual Model Chat

A beautiful, modern chat interface with dual AI model support, structured outputs, and self-prompting mechanisms.

## Features

- 🎨 **Floating Glass UI**: Modern glassmorphism design with smooth animations
- 🤖 **Dual Model Support**: Run one or two AI models simultaneously
- 🛠️ **10 Built-in Tools**: Models can use tools to think, remember, and act:
  - Memory & Notes: `note_me`, `store_memory`, `read_my_notes`, `read_my_memory`
  - Self-Messaging: `send_to_self`, `plan_next_action`
  - Execution: `execute_command`, `write_file`, `read_file`
  - Discovery: `list_my_tools`
- 📊 **Structured Outputs**: Models generate structured JSON outputs including:
  - `note_me`: Internal notes the model writes to itself
  - `memory`: Short-term and long-term memory storage
  - `next_action`: Next actions with self-prompting capability
- 💾 **File Persistence**: All outputs are saved to organized text files
- 🔄 **Self-Prompting**: Models can send messages back to themselves to continue their turn
- 📤 **Export System**: Export complete chat history and structured data
- 🧪 **Tools Demo Interface**: Test all tools with a visual interface

## Directory Structure

```
chat/
├── index.html          # Main chat interface
├── tools-demo.html     # Tool testing interface
├── styles.css          # Floating glass styling
├── app.js             # Frontend logic
├── server.js          # Backend API server
├── tool-executor.js    # Tool execution engine
├── package.json       # Node.js dependencies
├── schemas.json       # JSON schemas for structured outputs
├── tools.json         # Tool definitions for models
├── README.md          # This file
├── INTEGRATION.md     # AI model integration guide
├── HOW_MODELS_WORK.md # How models use tools
├── notes/            # Directory for note_me and actions
├── memory/           # Directory for short and long-term memory
└── exports/          # Directory for exported data
```

## Installation

1. **Install Node.js dependencies:**
   ```bash
   cd chat
   npm install
   ```

2. **Start the backend server:**
   ```bash
   npm start
   ```

3. **Open the chat interface:**
   - Open `index.html` in your browser, or
   - Navigate to `http://localhost:3000` if served by the backend

## Usage

### Basic Chat

1. **Toggle Model Mode**: Use the toggle switch in the header to switch between single and dual model mode
2. **Configure Models**: Enter names for Model 1 and Model 2, and check/uncheck their Active status
3. **Send Messages**: Type your message in the input area and click Send or press Enter
4. **View Outputs**: Structured outputs appear in the panel below the messages

### Structured Outputs

Each model generates three types of structured outputs:

#### 1. Note Me
Internal notes the model writes to itself:
```json
{
  "content": "Processing user request...",
  "priority": "medium",
  "timestamp": "2025-11-07T12:00:00.000Z"
}
```

#### 2. Memory
Both short-term and long-term memory:
```json
{
  "key": "msg_1_1",
  "value": "User asked about...",
  "type": "short_term",
  "timestamp": "2025-11-07T12:00:00.000Z"
}
```

#### 3. Next Action
Defines next actions and self-prompts:
```json
{
  "action": "continue_conversation",
  "reasoning": "User has provided input...",
  "self_prompt": "I should continue analyzing...",
  "timestamp": "2025-11-07T12:00:00.000Z"
}
```

### File Organization

**Notes Directory** (`notes/`):
- `note_model1_<timestamp>.txt` - Individual note_me files
- `actions_model1.txt` - Accumulated actions for Model 1
- `self_prompts_model1.txt` - All self-prompts from Model 1

**Memory Directory** (`memory/`):
- `short_term_model1.txt` - Short-term memories for Model 1
- `long_term_model1.txt` - Long-term memories for Model 1

**Exports Directory** (`exports/`):
- `chat_export_<timestamp>.json` - Complete data export in JSON
- `chat_export_<timestamp>.txt` - Human-readable export

### Self-Prompting Mechanism

The self-prompting feature allows models to continue their turn by sending messages back to themselves:

1. Model processes user input
2. Generates a `next_action` with a `self_prompt` field
3. The self-prompt is automatically sent back to the model
4. Model responds to its own prompt
5. This continues until the model sets an empty `self_prompt`

This prevents the model from stopping prematurely and enables deeper, multi-turn reasoning.

## API Endpoints

The backend server provides these endpoints:

- `POST /save-output` - Save structured output to files
- `POST /export` - Export all data
- `GET /notes` - Retrieve all notes
- `GET /memory` - Retrieve all memories
- `GET /schemas` - Get JSON schemas
- `GET /health` - Server health check

## Customization

### Adding New Output Types

1. Add schema to `schemas.json`:
   ```json
   "new_type": {
     "type": "object",
     "properties": { ... }
   }
   ```

2. Update `app.js` to generate the new type

3. Update `server.js` to handle saving the new type

### Styling

Modify `styles.css` to customize:
- Glass effect transparency (`backdrop-filter`, `background`)
- Colors (update `rgba()` values)
- Layout (modify flexbox properties)
- Animations (adjust `@keyframes`)

### Connecting Real AI Models

Replace the `simulateModelResponse()` method in `app.js` with actual API calls:

```javascript
async processWithModel(modelNum, userMessage) {
    const modelName = modelNum === 1 ? this.model1Name.value : this.model2Name.value;

    // Call your AI API
    const response = await fetch('YOUR_AI_API_ENDPOINT', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelName,
            message: userMessage
        })
    });

    const result = await response.json();
    // Process result...
}
```

## Testing Model Tools

The system includes a dedicated interface for testing all model tools:

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open the tools demo:**
   ```
   http://localhost:3000/tools-demo.html
   ```

3. **Test each tool:**
   - Select Model 1 or Model 2
   - Fill in parameters for any tool
   - Click "Test Tool" to execute
   - View results in real-time

**Available for testing:**
- `note_me` - Write notes to yourself
- `store_memory` - Save memories
- `send_to_self` - Message yourself
- `execute_command` - Run shell commands
- `list_my_tools` - See all available tools
- And 5 more...

**Command-line testing:**
```bash
# List all tools
curl http://localhost:3000/tools

# Execute a tool
curl -X POST http://localhost:3000/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "send_to_self",
    "parameters": {
      "message": "Testing self-messaging!"
    },
    "modelNum": 1,
    "modelName": "Test"
  }'
```

See `HOW_MODELS_WORK.md` for complete documentation on how models use these tools.

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (may need `-webkit-` prefixes for backdrop-filter)

## Development

**Run with auto-reload:**
```bash
npm run dev
```

**View server logs** to see file operations in real-time

**Debug frontend** by opening browser DevTools (F12) and checking the console

## Troubleshooting

**Server not connecting:**
- Ensure port 3000 is not in use
- Check that `npm install` completed successfully
- Verify Node.js is installed (`node --version`)

**Files not saving:**
- Check directory permissions for `notes/`, `memory/`, and `exports/`
- Look for error messages in the server console
- Data will fallback to localStorage if server is unavailable

**Styles not loading:**
- Clear browser cache
- Check that `styles.css` is in the same directory as `index.html`
- Verify file paths in the HTML

## License

MIT License - Feel free to modify and use as needed!

## Contributing

This is a customizable template. Extend it with:
- Real AI model integrations (OpenAI, Anthropic, etc.)
- Database storage instead of text files
- Advanced memory retrieval systems
- Multi-user support
- WebSocket for real-time updates

---

**Enjoy your dual model chat experience!** 🚀
