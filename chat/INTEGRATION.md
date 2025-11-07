# Integration Guide

This guide shows how to connect real AI models to your Floating Glass Dual Model Chat.

## Table of Contents

- [OpenAI Integration](#openai-integration)
- [Anthropic Claude Integration](#anthropic-claude-integration)
- [Generic REST API Integration](#generic-rest-api-integration)
- [Structured Output Parsing](#structured-output-parsing)

---

## OpenAI Integration

### 1. Install OpenAI SDK

```bash
npm install openai
```

### 2. Update `server.js`

Add at the top:
```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
```

### 3. Create an endpoint for OpenAI calls

```javascript
app.post('/chat/openai', async (req, res) => {
    try {
        const { message, model } = req.body;

        const completion = await openai.chat.completions.create({
            model: model || "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant that generates structured outputs.

For each response, you must also generate:
1. A note_me object with your internal thoughts
2. A memory object to remember important context
3. A next_action object with your next steps and a self_prompt to continue

Format your structured outputs as JSON at the end of your response.`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        const response = completion.choices[0].message.content;

        // Parse structured outputs from response
        const structuredOutputs = extractStructuredOutputs(response);

        res.json({
            success: true,
            response: response,
            structuredOutputs: structuredOutputs
        });

    } catch (error) {
        console.error('OpenAI API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

### 4. Update `app.js`

Replace `simulateModelResponse()`:

```javascript
async processWithModel(modelNum, userMessage) {
    const modelName = modelNum === 1 ? this.model1Name.value : this.model2Name.value;

    this.updateStatus(`Processing with ${modelName}...`, true);

    try {
        const response = await fetch(`${this.serverUrl}/chat/openai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: userMessage,
                model: 'gpt-4'
            })
        });

        const data = await response.json();

        if (data.success) {
            // Add model message
            this.addMessage(modelName, data.response, 'model', modelNum);

            // Process structured outputs
            if (data.structuredOutputs) {
                for (const [type, output] of Object.entries(data.structuredOutputs)) {
                    await this.saveStructuredOutput(modelNum, modelName, type, output);
                    this.displayStructuredOutput(modelNum, modelName, type, output);
                }

                // Handle self-prompting
                if (data.structuredOutputs.next_action?.self_prompt) {
                    await this.handleSelfPrompt(
                        modelNum,
                        modelName,
                        data.structuredOutputs.next_action.self_prompt
                    );
                }
            }
        }

    } catch (error) {
        console.error('Error processing with model:', error);
        this.addMessage('System', `Error: ${error.message}`, 'model', modelNum);
    }

    this.updateStatus('Ready');
}
```

---

## Anthropic Claude Integration

### 1. Install Anthropic SDK

```bash
npm install @anthropic-ai/sdk
```

### 2. Add to `server.js`

```javascript
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

app.post('/chat/claude', async (req, res) => {
    try {
        const { message, model } = req.body;

        const completion = await anthropic.messages.create({
            model: model || "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
                {
                    role: "user",
                    content: message
                }
            ],
            system: `You are an AI assistant that generates structured outputs.

For each response, generate these structured outputs:
1. note_me: Your internal thoughts
2. memory: Important context to remember
3. next_action: Next steps with a self_prompt field

End your response with JSON objects for each output type.`
        });

        const response = completion.content[0].text;
        const structuredOutputs = extractStructuredOutputs(response);

        res.json({
            success: true,
            response: response,
            structuredOutputs: structuredOutputs
        });

    } catch (error) {
        console.error('Claude API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

## Generic REST API Integration

For any AI API that accepts HTTP requests:

### 1. Create a generic endpoint

```javascript
app.post('/chat/generic', async (req, res) => {
    try {
        const { message, apiUrl, apiKey, modelName } = req.body;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                prompt: message,
                model: modelName,
                max_tokens: 1000
            })
        });

        const data = await response.json();

        // Adapt this based on your API's response format
        const text = data.text || data.response || data.output;
        const structuredOutputs = extractStructuredOutputs(text);

        res.json({
            success: true,
            response: text,
            structuredOutputs: structuredOutputs
        });

    } catch (error) {
        console.error('Generic API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

## Structured Output Parsing

Create a helper function to extract structured outputs from AI responses:

```javascript
function extractStructuredOutputs(text) {
    const outputs = {};

    try {
        // Method 1: Look for JSON code blocks
        const jsonBlocks = text.match(/```json\n([\s\S]*?)\n```/g);

        if (jsonBlocks) {
            jsonBlocks.forEach(block => {
                const json = block.replace(/```json\n/, '').replace(/\n```/, '');
                const parsed = JSON.parse(json);

                // Identify output type
                if (parsed.note_me) outputs.note_me = parsed.note_me;
                if (parsed.memory) outputs.memory = parsed.memory;
                if (parsed.next_action) outputs.next_action = parsed.next_action;
            });
        }

        // Method 2: Look for specific markers
        const noteMatch = text.match(/NOTE_ME:\s*({[\s\S]*?})/);
        if (noteMatch) {
            outputs.note_me = JSON.parse(noteMatch[1]);
        }

        const memoryMatch = text.match(/MEMORY:\s*({[\s\S]*?})/);
        if (memoryMatch) {
            outputs.memory = JSON.parse(memoryMatch[1]);
        }

        const actionMatch = text.match(/NEXT_ACTION:\s*({[\s\S]*?})/);
        if (actionMatch) {
            outputs.next_action = JSON.parse(actionMatch[1]);
        }

        // Method 3: If no outputs found, generate default ones
        if (Object.keys(outputs).length === 0) {
            const timestamp = new Date().toISOString();

            outputs.note_me = {
                content: "Processing user request",
                priority: "medium",
                timestamp: timestamp
            };

            outputs.memory = {
                key: `response_${Date.now()}`,
                value: text.substring(0, 100),
                type: "short_term",
                timestamp: timestamp
            };

            outputs.next_action = {
                action: "await_user_response",
                reasoning: "Completed response to user",
                self_prompt: "",
                timestamp: timestamp
            };
        }

    } catch (error) {
        console.error('Error parsing structured outputs:', error);
    }

    return outputs;
}
```

---

## Using Function Calling (OpenAI)

For models that support function calling:

```javascript
const tools = [
    {
        type: "function",
        function: {
            name: "generate_note_me",
            description: "Generate an internal note",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string" },
                    priority: { type: "string", enum: ["low", "medium", "high"] }
                },
                required: ["content", "priority"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "store_memory",
            description: "Store a memory",
            parameters: {
                type: "object",
                properties: {
                    key: { type: "string" },
                    value: { type: "string" },
                    type: { type: "string", enum: ["short_term", "long_term"] }
                },
                required: ["key", "value", "type"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "plan_next_action",
            description: "Plan the next action",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    reasoning: { type: "string" },
                    self_prompt: { type: "string" }
                },
                required: ["action", "reasoning", "self_prompt"]
            }
        }
    }
];

const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    tools: tools,
    tool_choice: "auto"
});

// Process tool calls
if (completion.choices[0].message.tool_calls) {
    for (const toolCall of completion.choices[0].message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        // Map function calls to structured output types
        if (functionName === 'generate_note_me') {
            outputs.note_me = { ...args, timestamp: new Date().toISOString() };
        } else if (functionName === 'store_memory') {
            outputs.memory = { ...args, timestamp: new Date().toISOString() };
        } else if (functionName === 'plan_next_action') {
            outputs.next_action = { ...args, timestamp: new Date().toISOString() };
        }
    }
}
```

---

## Environment Variables

Create a `.env` file:

```bash
# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Server Configuration
PORT=3000
NODE_ENV=development
```

Install dotenv:
```bash
npm install dotenv
```

Load in `server.js`:
```javascript
require('dotenv').config();
```

---

## Testing Your Integration

1. Start the server: `npm start`
2. Open the chat interface
3. Send a test message
4. Check the console for API calls
5. Verify structured outputs are being saved to files

---

## Best Practices

1. **Rate Limiting**: Implement rate limiting for API calls
2. **Error Handling**: Always catch and handle API errors gracefully
3. **Timeouts**: Set appropriate timeouts for API requests
4. **Retry Logic**: Implement exponential backoff for failed requests
5. **Logging**: Log all API interactions for debugging
6. **Security**: Never expose API keys in frontend code
7. **Validation**: Validate all structured outputs against schemas

---

## Troubleshooting

**API key errors:**
- Verify `.env` file exists and is loaded
- Check that API keys are valid
- Ensure proper permissions for the API key

**Timeout errors:**
- Increase timeout values
- Check network connectivity
- Verify API endpoint URLs

**Parsing errors:**
- Log raw API responses
- Test JSON parsing separately
- Implement fallback for malformed JSON

---

For more help, check the main README.md or consult your AI provider's documentation.
