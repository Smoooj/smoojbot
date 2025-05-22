// Initialize dotenv
require('dotenv').config();

// Importing http module - No longer directly used for Ollama/SD calls here
// const http = require('http'); // Keep if other http calls are made, otherwise remove. For now, assume not needed.
const fetch = require('node-fetch'); // Added for fetching image data

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, AttachmentBuilder } = require('discord.js'); // Added AttachmentBuilder directly
// const Discord = require('discord.js'); // Client and other classes are destructured, Discord global might be redundant

// Import client functions
const { getOllamaResponse } = require('./ollamaClient.js');
const { generateImage } = require('./stableDiffusionClient.js');

// Bot-specific configurations from environment variables (if any remain here)
const PERSONALITY = process.env.PERSONALITY || ""; // Example if used directly in prompt construction here
const SHOULD_ENGAGE_PROMPT_BASE = process.env.SHOULD_ENGAGE_PROMPT_BASE || ""; // Example
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || ""; // Example

let OllamaContext = [0]; 

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessageReactions] });

// When the client is ready, run this code (only once).
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
if (!process.env.CLIENT_TOKEN) {
    console.error("FATAL: CLIENT_TOKEN environment variable is not set.");
    process.exit(1);
}
client.login(process.env.CLIENT_TOKEN);

client.on('messageCreate', async msg => { // Made async to use await
    console.log(`Saw message from ${msg.author.username}: ${msg.content}`);
    if (msg.author.bot) // More robust check for bot messages
    {
        return;
    }

    let chatString = msg.author.displayName.concat(" says: ");
    // Potentially add PERSONALITY or SYSTEM_PROMPT to the prompt here if desired
    let promptForOllama = `${SYSTEM_PROMPT} ${chatString} ${msg.content}`.trim(); // Example of using SYSTEM_PROMPT
    let imageDatas = [];

    if (msg.attachments.size > 0) {
        for (const attachment of msg.attachments.values()) {
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                try {
                    console.log(`Fetching image from: ${attachment.url}`);
                    const response = await fetch(attachment.url);
                    if (!response.ok) {
                        console.error(`Failed to fetch image: ${response.statusText}`);
                        continue; // Skip this attachment
                    }
                    const imageBuffer = await response.buffer();
                    imageDatas.push(imageBuffer.toString('base64'));
                    console.log(`Successfully fetched and encoded image: ${attachment.name}`);
                } catch (error) {
                    console.error(`Error processing attachment ${attachment.name}:`, error);
                }
            }
        }
    }

    try {
        // Pass imageDatas to getOllamaResponse. If imageDatas is empty, it will be handled by ollamaClient
        const ollamaResult = await getOllamaResponse(promptForOllama, OllamaContext, imageDatas);

        if (ollamaResult && ollamaResult.response) {
            if (!ollamaResult.response.startsWith('PASS')) {
                let messageToSend = ollamaResult.response;
                let imageBase64 = null;

                if (messageToSend.includes('image attached')) {
                    const parts = messageToSend.split('image attached');
                    messageToSend = parts[0].trim();
                    const SDPrompt = parts[1].trim();
                    
                    if (SDPrompt) { // Ensure there is a prompt for SD
                        console.log(`Requesting image generation with prompt: "${SDPrompt}"`);
                        try {
                            imageBase64 = await generateImage(SDPrompt);
                        } catch (sdError) {
                            console.error("Stable Diffusion image generation failed:", sdError);
                            msg.reply("I tried to generate an image, but something went wrong. Sorry!").catch(console.error);
                        }
                    }
                }

                // Send text message if there is one
                if (messageToSend) {
                    client.channels.cache.get(msg.channelId).send(messageToSend).catch(console.error);
                }

                // Send image if generated
                if (imageBase64) {
                    try {
                        const sfbuff = Buffer.from(imageBase64, "base64");
                        const sfattach = new AttachmentBuilder(sfbuff, { name: "output.png" });
                        client.channels.cache.get(msg.channelId).send({ files: [sfattach] }).catch(console.error);
                    } catch (e) {
                        console.error("Error processing or sending image:", e);
                        msg.reply("I generated an image, but had trouble sending it. Sorry!").catch(console.error);
                    }
                }
            }
            OllamaContext = ollamaResult.context; // Update context
        } else {
            console.log("Received an empty or invalid response from Ollama.");
        }
        // console.log('Ollama Body in discordbot.js:', ollamaResult); // For debugging the full result

    } catch (ollamaError) {
        console.error("Failed to get response from Ollama:", ollamaError);
        msg.reply("Sorry, I'm having trouble thinking right now!").catch(console.error);
    }
});

// Note: The GetImageWithPrompt function has been moved to stableDiffusionClient.js
// and its core logic (API call) is now part of generateImage.
// The Discord interaction part (sending the image) is handled above.

// Example of how SDURL and OllamaAPI (if needed) could be constructed if client files don't export them
// These are not strictly necessary if the client files manage their own endpoints internally.
// const OLLAMA_HOSTNAME = process.env.OLLAMA_HOSTNAME || "192.168.216.84";
// const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";
// const OLLAMA_API_PATH = process.env.OLLAMA_API_PATH || "/api/generate";
// const SD_HOSTNAME = process.env.SD_HOSTNAME || "192.168.216.84";
// const SD_PORT = process.env.SD_PORT || "7860";
// const SD_API_PATH = process.env.SD_API_PATH || "/sdapi/v1/txt2img";
// const OllamaAPIURL = `http://${OLLAMA_HOSTNAME}:${OLLAMA_PORT}${OLLAMA_API_PATH}`;
// const SDAPIURL = `http://${SD_HOSTNAME}:${SD_PORT}${SD_API_PATH}`;
// console.log("Ollama API URL (from discordbot.js):", OllamaAPIURL); // For debug
// console.log("SD API URL (from discordbot.js):", SDAPIURL); // For debug

// The commented out fetch example for Stable Diffusion is no longer relevant here as its logic is in stableDiffusionClient.js
/*
    //Trying a new, more modern method, fetch
    const result = await fetch(SDAPIURL, { // Use the constructed SDURL from env vars
        method: 'POST',
        body: JSON.stringify({
            prompt: SDprompt, 
            steps: 6,
            // ...
        })
      }).then(res => res.json());
      // ...
*/
