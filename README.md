# SmoojBot - Discord AI Chatbot

SmoojBot is an intelligent Discord chatbot that combines the power of Large Language Models (LLM) with image generation and understanding capabilities. The bot can engage in conversations, generate images based on text prompts, and analyze images shared in Discord channels.

## Features

- **🤖 AI Conversations**: Powered by Ollama LLM for natural language processing
- **🎨 Image Generation**: Creates images using Stable Diffusion based on text prompts
- **👁️ Image Understanding**: Analyzes and describes images shared in Discord
- **🔄 Smart Image Verification**: Automatically verifies generated images match prompts and retries if needed
- **💭 Context Awareness**: Maintains conversation context across messages
- **🏠 Channel Isolation**: Separate conversation contexts for each Discord channel
- **👤 User Personalization**: Tracks individual user preferences and conversation history
- **🧠 Smart Summarization**: Automatically summarizes user interactions for personalized responses
- **🐳 Docker Support**: Easy deployment with Docker containers

## Architecture

```
Discord Message → SmoojBot → Ollama LLM → Response
                     ↓
              Stable Diffusion API → Image Generation
                     ↓
              Ollama Vision → Image Verification
```

## Prerequisites

Before setting up SmoojBot, you'll need:

1. **Discord Bot Token**: Create a Discord application and bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. **Ollama Server**: Running instance of Ollama with a vision-capable model
3. **Stable Diffusion API**: Running instance of Stable Diffusion WebUI with API enabled
4. **Node.js**: Version 20 or higher

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Smoooj/smoojbot.git
cd smoojbot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Discord Bot Configuration
CLIENT_TOKEN=your_discord_bot_token_here

# Ollama LLM Service Configuration
OLLAMA_HOSTNAME=192.168.216.84
OLLAMA_PORT=11434
OLLAMA_MODEL=Smooj

# Stable Diffusion Image Generation Service Configuration
SD_HOSTNAME=192.168.216.84
SD_PORT=7860

# Bot Personality Configuration
SYSTEM_PROMPT="You are Smooj, a friendly Discord bot who remembers users and builds relationships over time. Respond like a warm, conversational friend who genuinely cares about people. Use any context you have about users naturally - reference their interests, ongoing situations, or previous conversations when relevant to the current message. Always address what they just said first, then add personal touches that enhance the conversation. Ask follow-up questions, show enthusiasm for their achievements, and be supportive during challenges. Keep responses natural and engaging, avoiding formal or robotic language. If generating images, include 'image attached' followed by a detailed prompt. Your goal is creating a welcoming community where everyone feels remembered and valued."
```

### 4. Run the Bot

```bash
node discordbot.js
```

## Detailed Setup

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the bot token and add it to your `.env` file as `CLIENT_TOKEN`
6. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
   - Server Members Intent (if needed)
7. Go to "OAuth2" → "URL Generator"
8. Select scopes: `bot`
9. Select bot permissions: `Send Messages`, `Read Message History`, `Attach Files`
10. Use the generated URL to invite the bot to your server

### Ollama Setup

1. Install Ollama on your server: [Ollama Installation Guide](https://ollama.ai/)
2. Pull a vision-capable model (e.g., `llava`, `bakllava`, or custom model):
   ```bash
   ollama pull llava
   ```
3. Start Ollama server:
   ```bash
   ollama serve
   ```
4. Update `OLLAMA_HOSTNAME`, `OLLAMA_PORT`, and `OLLAMA_MODEL` in your `.env` file

### Stable Diffusion Setup

1. Install [AUTOMATIC1111 Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
2. Start with API enabled:
   ```bash
   ./webui.sh --api --listen
   ```
3. Update `SD_HOSTNAME` and `SD_PORT` in your `.env` file

## Docker Deployment

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  smoojbot:
    build: .
    environment:
      - CLIENT_TOKEN=${CLIENT_TOKEN}
      - OLLAMA_HOSTNAME=${OLLAMA_HOSTNAME}
      - OLLAMA_PORT=${OLLAMA_PORT}
      - OLLAMA_MODEL=${OLLAMA_MODEL}
      - SD_HOSTNAME=${SD_HOSTNAME}
      - SD_PORT=${SD_PORT}
    restart: unless-stopped
    depends_on:
      - ollama
      - stable-diffusion

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

  stable-diffusion:
    # Use your preferred Stable Diffusion Docker image
    image: your-stable-diffusion-image
    ports:
      - "7860:7860"
    restart: unless-stopped

volumes:
  ollama_data:
```

Run with:
```bash
docker-compose up -d
```

### Using Docker Only

Build and run the bot container:

```bash
# Build the image
docker build -f Dockerfile.dockerfile -t smoojbot .

# Run the container
docker run -d \
  --name smoojbot \
  --env-file .env \
  --restart unless-stopped \
  smoojbot
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CLIENT_TOKEN` | Discord bot token | - | ✅ |
| `OLLAMA_HOSTNAME` | Ollama server hostname | `192.168.216.84` | ✅ |
| `OLLAMA_PORT` | Ollama server port | `11434` | ✅ |
| `OLLAMA_MODEL` | Ollama model name | `Smooj` | ✅ |
| `OLLAMA_SUMMARY_MODEL` | Model for user context summarization | `llama3.2:3b` | ❌ |
| `OLLAMA_API_PATH` | Ollama API endpoint | `/api/generate` | ❌ |
| `SD_HOSTNAME` | Stable Diffusion hostname | `192.168.216.84` | ✅ |
| `SD_PORT` | Stable Diffusion port | `7860` | ✅ |
| `SD_API_PATH` | Stable Diffusion API endpoint | `/sdapi/v1/txt2img` | ❌ |
| `SYSTEM_PROMPT` | Bot personality prompt | `""` | ❌ |
| `PERSONALITY` | Additional personality config | `""` | ❌ |

### Image Generation Settings

The bot uses these Stable Diffusion parameters (configured in `stableDiffusionClient.js`):

- **Steps**: 6 (fast generation)
- **Sampler**: DPM++ SDE
- **Scheduler**: Karras
- **CFG Scale**: 2
- **Resolution**: 768x768

## Usage

### Basic Chat
Simply mention the bot or send a message in a channel where the bot has access:
```
@SmoojBot Hello! How are you today?
```

### Image Generation
To generate an image, include "image attached" in the bot's response trigger:
```
@SmoojBot Can you create an image of a sunset over mountains? image attached a beautiful sunset over snow-capped mountains
```

### Image Analysis
Upload an image and ask the bot about it:
```
@SmoojBot What do you see in this image?
```

## How It Works

1. **Message Processing**: Bot receives Discord messages and processes text/attachments
2. **Context Management**: 
   - **Channel Context**: Maintains conversation flow within each Discord channel separately
   - **User Context**: Tracks all messages from each user across all channels for personalization
3. **LLM Integration**: Sends prompts to Ollama with both channel context and user personalization data
4. **Smart Summarization**: Automatically summarizes user interactions after every 20 messages using a separate model
5. **Image Generation**: When response contains "image attached", extracts prompt and generates image via Stable Diffusion
6. **Verification Loop**: Uses Ollama's vision capabilities to verify generated images match the prompt
7. **Retry Logic**: If verification fails, generates new images (up to 3 attempts)

### Context System Details

**Channel Isolation**: Each Discord channel maintains its own conversation context, allowing the bot to have different ongoing conversations in different channels without confusion.

**User Personalization**: The bot tracks every message from every user across all channels, building a comprehensive understanding of each user's:
- Interests and preferences
- Communication style
- Personal details they've shared
- Conversation history

**Automatic Summarization**: When a user has sent more than 20 messages, the bot automatically summarizes their interaction history using a dedicated summarization model (configurable via `OLLAMA_SUMMARY_MODEL`). This keeps the user context manageable while preserving important personalization data.

## System Prompt Configuration

The bot's personality and behavior are controlled by the `SYSTEM_PROMPT` environment variable. Two optimized prompts are provided:

### Full System Prompt (`system-prompt-smooj.txt`)
A comprehensive prompt with detailed guidelines for:
- Personality traits and conversation style
- How to use user context effectively
- Response structure and examples
- What to avoid in conversations

### Concise System Prompt (`system-prompt-concise.txt`)
A streamlined version perfect for environment variables, containing the essential instructions for friendly, context-aware responses.

**Recommendation**: Use the concise version in your `.env` file for optimal performance while maintaining the friendly, personalized conversation style.

## Testing

Run the test suite:

```bash
npm test
```

The tests cover:
- Ollama client functionality
- Stable Diffusion client functionality
- Discord bot message handling
- Image verification and retry logic

## Troubleshooting

### Common Issues

1. **Bot doesn't respond**
   - Check Discord bot token is correct
   - Verify bot has necessary permissions in the server
   - Check Ollama server is running and accessible

2. **Image generation fails**
   - Verify Stable Diffusion WebUI is running with `--api` flag
   - Check network connectivity to SD server
   - Ensure SD server has sufficient resources

3. **Image verification not working**
   - Confirm Ollama model supports vision (e.g., llava, bakllava)
   - Check Ollama server has enough memory for vision tasks

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=true node discordbot.js
```

### Logs

Check application logs for detailed error information:
```bash
# Docker logs
docker logs smoojbot

# Direct execution logs
node discordbot.js 2>&1 | tee bot.log
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## License

This project is open source. Please check the repository for license details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

## Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API library
- [Ollama](https://ollama.ai/) - Local LLM runtime
- [AUTOMATIC1111 Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) - Image generation