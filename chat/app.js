// Dual Model Chat Application
class DualModelChat {
    constructor() {
        this.messages = [];
        this.structuredOutputs = [];
        this.isDualMode = true;
        this.messageCount = 0;
        this.serverUrl = 'http://localhost:3000'; // Backend server URL

        // JSON Schemas for structured outputs
        this.schemas = {
            note_me: {
                type: "object",
                properties: {
                    content: { type: "string", description: "Note content for self" },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    timestamp: { type: "string", format: "date-time" }
                },
                required: ["content", "priority", "timestamp"]
            },
            memory: {
                type: "object",
                properties: {
                    key: { type: "string", description: "Memory key/identifier" },
                    value: { type: "string", description: "Memory content" },
                    type: { type: "string", enum: ["short_term", "long_term"] },
                    timestamp: { type: "string", format: "date-time" }
                },
                required: ["key", "value", "type", "timestamp"]
            },
            next_action: {
                type: "object",
                properties: {
                    action: { type: "string", description: "Next action to take" },
                    reasoning: { type: "string", description: "Why this action" },
                    self_prompt: { type: "string", description: "Message to send back to self" },
                    timestamp: { type: "string", format: "date-time" }
                },
                required: ["action", "reasoning", "self_prompt", "timestamp"]
            }
        };

        this.initElements();
        this.initEventListeners();
        this.loadFromLocalStorage();
    }

    initElements() {
        // Get DOM elements
        this.dualModelToggle = document.getElementById('dualModelToggle');
        this.model1Name = document.getElementById('model1Name');
        this.model2Name = document.getElementById('model2Name');
        this.model1Active = document.getElementById('model1Active');
        this.model2Active = document.getElementById('model2Active');
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearButton = document.getElementById('clearButton');
        this.exportButton = document.getElementById('exportButton');
        this.statusText = document.getElementById('statusText');
        this.messageCountEl = document.getElementById('messageCount');
        this.outputDisplay = document.getElementById('outputDisplay');
        this.container = document.querySelector('.floating-chat-container');
    }

    initEventListeners() {
        // Toggle dual/single mode
        this.dualModelToggle.addEventListener('change', (e) => {
            this.isDualMode = e.target.checked;
            if (this.isDualMode) {
                this.container.classList.remove('single-model');
            } else {
                this.container.classList.add('single-model');
            }
            this.updateStatus('Mode changed to ' + (this.isDualMode ? 'Dual' : 'Single'));
        });

        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Clear chat
        this.clearButton.addEventListener('click', () => this.clearChat());

        // Export data
        this.exportButton.addEventListener('click', () => this.exportData());
    }

    async sendMessage() {
        const content = this.userInput.value.trim();
        if (!content) return;

        // Add user message
        this.addMessage('User', content, 'user');
        this.userInput.value = '';

        // Process with active models
        if (this.isDualMode) {
            if (this.model1Active.checked) {
                await this.processWithModel(1, content);
            }
            if (this.model2Active.checked) {
                await this.processWithModel(2, content);
            }
        } else {
            if (this.model1Active.checked) {
                await this.processWithModel(1, content);
            }
        }

        this.saveToLocalStorage();
    }

    async processWithModel(modelNum, userMessage) {
        const modelName = modelNum === 1 ? this.model1Name.value : this.model2Name.value;

        this.updateStatus(`Processing with ${modelName}...`, true);

        // Simulate model response (in real implementation, call your AI API)
        await this.simulateModelResponse(modelNum, modelName, userMessage);

        this.updateStatus('Ready');
    }

    async simulateModelResponse(modelNum, modelName, userMessage) {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate structured outputs
        const timestamp = new Date().toISOString();

        // Create note_me
        const noteMe = {
            content: `Processing user request: "${userMessage.substring(0, 50)}..."`,
            priority: "medium",
            timestamp: timestamp
        };

        // Create memory
        const memory = {
            key: `msg_${this.messageCount}_${modelNum}`,
            value: `User asked: ${userMessage}`,
            type: "short_term",
            timestamp: timestamp
        };

        // Create next_action with self-prompt
        const nextAction = {
            action: "continue_conversation",
            reasoning: "User has provided input that requires response and follow-up",
            self_prompt: `I should continue analyzing the user's request: "${userMessage}". Let me think about the best way to respond and what follow-up questions might be helpful.`,
            timestamp: timestamp
        };

        // Generate response
        const response = `[${modelName}] I've received your message: "${userMessage}". I'm processing this and will continue the conversation.`;

        // Add model message
        this.addMessage(modelName, response, 'model', modelNum);

        // Save structured outputs
        await this.saveStructuredOutput(modelNum, modelName, 'note_me', noteMe);
        await this.saveStructuredOutput(modelNum, modelName, 'memory', memory);
        await this.saveStructuredOutput(modelNum, modelName, 'next_action', nextAction);

        // Display structured outputs
        this.displayStructuredOutput(modelNum, modelName, 'note_me', noteMe);
        this.displayStructuredOutput(modelNum, modelName, 'memory', memory);
        this.displayStructuredOutput(modelNum, modelName, 'next_action', nextAction);

        // Self-prompting mechanism: send the self_prompt back to the model
        if (nextAction.self_prompt) {
            await this.handleSelfPrompt(modelNum, modelName, nextAction.self_prompt);
        }
    }

    async handleSelfPrompt(modelNum, modelName, selfPrompt) {
        // Wait a bit before self-prompting
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add internal message showing the self-prompt
        const internalMsg = `[${modelName} - Internal] ${selfPrompt}`;
        this.addMessage(`${modelName} (thinking)`, internalMsg, 'model', modelNum);

        // Generate response to self-prompt
        await new Promise(resolve => setTimeout(resolve, 800));

        const selfResponse = `[${modelName}] After reflecting, I believe the best approach is to provide a comprehensive response and ask clarifying questions if needed.`;
        this.addMessage(`${modelName} (response)`, selfResponse, 'model', modelNum);

        // Create another next_action to keep the conversation going
        const timestamp = new Date().toISOString();
        const continuationAction = {
            action: "await_user_response",
            reasoning: "Completed initial processing, now waiting for user feedback",
            self_prompt: "", // Empty to stop the loop
            timestamp: timestamp
        };

        await this.saveStructuredOutput(modelNum, modelName, 'next_action', continuationAction);
    }

    async saveStructuredOutput(modelNum, modelName, type, data) {
        const output = {
            model: modelNum,
            modelName: modelName,
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        };

        this.structuredOutputs.push(output);

        // Save to backend
        try {
            const response = await fetch(`${this.serverUrl}/save-output`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(output)
            });

            if (!response.ok) {
                console.warn('Could not save to server, saving locally only');
            }
        } catch (error) {
            console.warn('Server not available, saving locally only:', error.message);
            // Fallback to localStorage
            this.saveToLocalStorage();
        }
    }

    displayStructuredOutput(modelNum, modelName, type, data) {
        const outputItem = document.createElement('div');
        outputItem.className = 'output-item';

        outputItem.innerHTML = `
            <div class="output-item-header">
                <span class="output-type">${type}</span>
                <span class="output-model">${modelName}</span>
            </div>
            <div class="output-content">${JSON.stringify(data, null, 2)}</div>
        `;

        this.outputDisplay.insertBefore(outputItem, this.outputDisplay.firstChild);

        // Keep only last 5 outputs visible
        while (this.outputDisplay.children.length > 5) {
            this.outputDisplay.removeChild(this.outputDisplay.lastChild);
        }
    }

    addMessage(sender, content, type, modelNum = null) {
        const message = {
            sender,
            content,
            type,
            modelNum,
            timestamp: new Date().toISOString()
        };

        this.messages.push(message);
        this.messageCount++;

        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}-message`;
        if (type === 'model' && modelNum) {
            messageEl.classList.add(`model-${modelNum}`);
        }

        const time = new Date(message.timestamp).toLocaleTimeString();

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${sender}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(content)}</div>
        `;

        // Remove welcome message if it exists
        const welcomeMsg = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        this.chatMessages.appendChild(messageEl);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        this.updateMessageCount();
    }

    updateStatus(text, processing = false) {
        this.statusText.textContent = text;
        if (processing) {
            this.statusText.classList.add('processing');
        } else {
            this.statusText.classList.remove('processing');
        }
    }

    updateMessageCount() {
        this.messageCountEl.textContent = `Messages: ${this.messageCount}`;
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.messages = [];
            this.messageCount = 0;
            this.chatMessages.innerHTML = `
                <div class="welcome-message">
                    <p>Chat cleared!</p>
                    <p>Start a new conversation.</p>
                </div>
            `;
            this.outputDisplay.innerHTML = '';
            this.updateMessageCount();
            this.updateStatus('Chat cleared');
            this.saveToLocalStorage();
        }
    }

    async exportData() {
        const exportData = {
            messages: this.messages,
            structuredOutputs: this.structuredOutputs,
            exportDate: new Date().toISOString(),
            modelConfig: {
                isDualMode: this.isDualMode,
                model1: {
                    name: this.model1Name.value,
                    active: this.model1Active.checked
                },
                model2: {
                    name: this.model2Name.value,
                    active: this.model2Active.checked
                }
            }
        };

        // Try to save to server
        try {
            const response = await fetch(`${this.serverUrl}/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(exportData)
            });

            if (response.ok) {
                const result = await response.json();
                this.updateStatus(`Exported to: ${result.filename}`);
                return;
            }
        } catch (error) {
            console.warn('Server export failed, downloading locally');
        }

        // Fallback to local download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.updateStatus('Data exported locally');
    }

    saveToLocalStorage() {
        const data = {
            messages: this.messages,
            structuredOutputs: this.structuredOutputs,
            messageCount: this.messageCount
        };
        localStorage.setItem('dualModelChat', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('dualModelChat');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.messages = data.messages || [];
                this.structuredOutputs = data.structuredOutputs || [];
                this.messageCount = data.messageCount || 0;

                // Restore messages to UI
                if (this.messages.length > 0) {
                    const welcomeMsg = this.chatMessages.querySelector('.welcome-message');
                    if (welcomeMsg) welcomeMsg.remove();

                    this.messages.forEach(msg => {
                        const messageEl = document.createElement('div');
                        messageEl.className = `message ${msg.type}-message`;
                        if (msg.type === 'model' && msg.modelNum) {
                            messageEl.classList.add(`model-${msg.modelNum}`);
                        }

                        const time = new Date(msg.timestamp).toLocaleTimeString();
                        messageEl.innerHTML = `
                            <div class="message-header">
                                <span class="message-sender">${msg.sender}</span>
                                <span class="message-time">${time}</span>
                            </div>
                            <div class="message-content">${this.escapeHtml(msg.content)}</div>
                        `;
                        this.chatMessages.appendChild(messageEl);
                    });
                }

                this.updateMessageCount();
            } catch (error) {
                console.error('Failed to load from localStorage:', error);
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new DualModelChat();

    // Make app globally accessible for debugging
    window.dualModelChat = app;

    console.log('Dual Model Chat initialized!');
    console.log('Schemas:', app.schemas);
});
