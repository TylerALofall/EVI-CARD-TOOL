const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const ToolExecutor = require('./tool-executor');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Directories for file storage
const NOTES_DIR = path.join(__dirname, 'notes');
const MEMORY_DIR = path.join(__dirname, 'memory');
const EXPORTS_DIR = path.join(__dirname, 'exports');

// Initialize tool executor
let toolExecutor;

// Ensure directories exist
async function initDirectories() {
    const dirs = [NOTES_DIR, MEMORY_DIR, EXPORTS_DIR];
    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`✓ Directory ready: ${dir}`);
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
        }
    }

    // Initialize tool executor
    toolExecutor = new ToolExecutor(NOTES_DIR, MEMORY_DIR);
    console.log('✓ Tool executor initialized');
}

// Helper function to generate filename
function generateFilename(prefix, extension = 'txt') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${timestamp}.${extension}`;
}

// Helper function to append to file
async function appendToFile(filePath, content) {
    try {
        await fs.appendFile(filePath, content + '\n---\n\n');
        return true;
    } catch (error) {
        console.error(`Error appending to file ${filePath}:`, error);
        return false;
    }
}

// Routes

// Save structured output
app.post('/save-output', async (req, res) => {
    try {
        const { model, modelName, type, data, timestamp } = req.body;

        const output = {
            model,
            modelName,
            type,
            data,
            timestamp
        };

        const formattedOutput = `
[${timestamp}] Model ${model} (${modelName})
Type: ${type}
Data: ${JSON.stringify(data, null, 2)}
`;

        // Determine which file to write to
        let filePath;
        let filename;

        switch (type) {
            case 'note_me':
                // Each note_me goes to its own file
                filename = generateFilename(`note_model${model}`);
                filePath = path.join(NOTES_DIR, filename);
                await fs.writeFile(filePath, formattedOutput);
                break;

            case 'memory':
                // Short-term memories: append to per-message file
                // Long-term memories: append to long-term file
                if (data.type === 'short_term') {
                    filename = `short_term_model${model}.txt`;
                    filePath = path.join(MEMORY_DIR, filename);
                    await appendToFile(filePath, formattedOutput);
                } else {
                    filename = `long_term_model${model}.txt`;
                    filePath = path.join(MEMORY_DIR, filename);
                    await appendToFile(filePath, formattedOutput);
                }
                break;

            case 'next_action':
                // Actions append to actions file
                filename = `actions_model${model}.txt`;
                filePath = path.join(NOTES_DIR, filename);
                await appendToFile(filePath, formattedOutput);

                // If there's a self_prompt, save it separately
                if (data.self_prompt) {
                    const selfPromptFilename = `self_prompts_model${model}.txt`;
                    const selfPromptPath = path.join(NOTES_DIR, selfPromptFilename);
                    const selfPromptContent = `
[${timestamp}] Model ${model} (${modelName})
Self-Prompt: ${data.self_prompt}
Reasoning: ${data.reasoning}
`;
                    await appendToFile(selfPromptPath, selfPromptContent);
                }
                break;

            default:
                // Generic output
                filename = generateFilename(`output_model${model}`);
                filePath = path.join(NOTES_DIR, filename);
                await fs.writeFile(filePath, formattedOutput);
        }

        res.json({
            success: true,
            message: 'Output saved successfully',
            filename: filename
        });

    } catch (error) {
        console.error('Error saving output:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Export all data
app.post('/export', async (req, res) => {
    try {
        const data = req.body;
        const filename = generateFilename('chat_export', 'json');
        const filePath = path.join(EXPORTS_DIR, filename);

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));

        // Also create a human-readable text version
        const textFilename = generateFilename('chat_export', 'txt');
        const textFilePath = path.join(EXPORTS_DIR, textFilename);

        let textContent = `CHAT EXPORT
Generated: ${data.exportDate}
Mode: ${data.modelConfig.isDualMode ? 'Dual' : 'Single'}

=== MODEL CONFIGURATION ===
Model 1: ${data.modelConfig.model1.name} (${data.modelConfig.model1.active ? 'Active' : 'Inactive'})
Model 2: ${data.modelConfig.model2.name} (${data.modelConfig.model2.active ? 'Active' : 'Inactive'})

=== MESSAGES (${data.messages.length}) ===

`;

        data.messages.forEach((msg, idx) => {
            textContent += `[${idx + 1}] ${msg.timestamp}
From: ${msg.sender}
Type: ${msg.type}
Content: ${msg.content}

---

`;
        });

        textContent += `
=== STRUCTURED OUTPUTS (${data.structuredOutputs.length}) ===

`;

        data.structuredOutputs.forEach((output, idx) => {
            textContent += `[${idx + 1}] ${output.timestamp}
Model: ${output.modelName}
Type: ${output.type}
Data: ${JSON.stringify(output.data, null, 2)}

---

`;
        });

        await fs.writeFile(textFilePath, textContent);

        res.json({
            success: true,
            filename: filename,
            textFilename: textFilename,
            path: filePath
        });

    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all notes
app.get('/notes', async (req, res) => {
    try {
        const files = await fs.readdir(NOTES_DIR);
        const notes = [];

        for (const file of files) {
            const filePath = path.join(NOTES_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            notes.push({
                filename: file,
                content: content
            });
        }

        res.json({ success: true, notes });
    } catch (error) {
        console.error('Error reading notes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all memories
app.get('/memory', async (req, res) => {
    try {
        const files = await fs.readdir(MEMORY_DIR);
        const memories = [];

        for (const file of files) {
            const filePath = path.join(MEMORY_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            memories.push({
                filename: file,
                content: content
            });
        }

        res.json({ success: true, memories });
    } catch (error) {
        console.error('Error reading memories:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get schemas
app.get('/schemas', async (req, res) => {
    try {
        const schemasPath = path.join(__dirname, 'schemas.json');
        const schemas = await fs.readFile(schemasPath, 'utf-8');
        res.json({ success: true, schemas: JSON.parse(schemas) });
    } catch (error) {
        console.error('Error reading schemas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute tool
app.post('/execute-tool', async (req, res) => {
    try {
        const { toolName, parameters, modelNum, modelName } = req.body;

        if (!toolExecutor) {
            return res.status(500).json({
                success: false,
                error: 'Tool executor not initialized'
            });
        }

        const result = await toolExecutor.executeTool(
            toolName,
            parameters,
            modelNum,
            modelName
        );

        res.json(result);

    } catch (error) {
        console.error('Error executing tool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available tools
app.get('/tools', (req, res) => {
    try {
        const toolsPath = path.join(__dirname, 'tools.json');
        const toolsData = require(toolsPath);

        res.json({
            success: true,
            tools: toolsData.tools,
            categories: toolsData.tool_categories,
            system_prompt: toolsData.system_prompt
        });
    } catch (error) {
        console.error('Error reading tools:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Chat endpoint with tool support
app.post('/chat', async (req, res) => {
    try {
        const { message, modelNum, modelName, conversationHistory } = req.body;

        // This is where you would integrate with a real AI model
        // For now, return the system prompt and available tools
        const toolsPath = path.join(__dirname, 'tools.json');
        const toolsData = require(toolsPath);

        res.json({
            success: true,
            message: 'To integrate with real AI models, see INTEGRATION.md',
            system_prompt: toolsData.system_prompt,
            available_tools: toolsData.tools,
            conversation_id: `conv_${Date.now()}_model${modelNum}`
        });

    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Dual Model Chat Server is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
async function startServer() {
    await initDirectories();

    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════╗
║  Dual Model Chat Server with Tools           ║
║  Running on http://localhost:${PORT}           ║
║                                               ║
║  Endpoints:                                   ║
║  - POST /chat              Chat with AI       ║
║  - POST /execute-tool      Execute tools      ║
║  - GET  /tools             List all tools     ║
║  - POST /save-output       Save outputs       ║
║  - POST /export            Export data        ║
║  - GET  /notes             Get notes          ║
║  - GET  /memory            Get memories       ║
║  - GET  /schemas           Get schemas        ║
║  - GET  /health            Health check       ║
╚═══════════════════════════════════════════════╝
        `);
    });
}

startServer().catch(console.error);
