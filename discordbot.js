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
// const { analyzeImage } = require('./cloudVisionClient.js'); // analyzeImage is no longer used

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
                    
                    // const SDPrompt = parts[1].trim(); // Already defined above
                    // imageBase64 is handled by the new logic with postedMessage

                    if (SDPrompt) { // Ensure there is a prompt for SD
                        let initialImageBase64;
                        try {
                            initialImageBase64 = await generateImage(SDPrompt);
                        } catch (genError) {
                            console.error("Initial image generation failed:", genError);
                            msg.reply("I tried to generate an image, but something went wrong. Sorry!").catch(console.error);
                            // imageBase64 remains null or undefined, skip verification loop.
                            // Send only text message if it exists
                            if (messageToSend) {
                                client.channels.cache.get(msg.channelId).send(messageToSend).catch(console.error);
                            }
                            return; // Exit this part of message processing
                        }

                        if (!initialImageBase64) {
                            msg.reply("I tried to generate an image, but couldn't get one. Sorry!").catch(console.error);
                            if (messageToSend) {
                                client.channels.cache.get(msg.channelId).send(messageToSend).catch(console.error);
                            }
                            return; // Exit this part of message processing
                        }

                        // Initial Image Post
                        const initialAttach = new AttachmentBuilder(Buffer.from(initialImageBase64, "base64"), { name: "output.png" });
                        let postedMessage = await client.channels.cache.get(msg.channelId).send({
                            content: messageToSend, // Text part from Ollama's initial response
                            files: [initialAttach]
                        }).catch(err => {
                            console.error("Error sending initial image message:", err);
                            msg.reply("I had trouble posting the first image. Sorry!").catch(console.error);
                            return null; // Indicate failure
                        });

                        if (!postedMessage) { // If initial post failed
                            // messageToSend might still be relevant if the image post failed but text is good
                            if (messageToSend && !initialImageBase64) { // Resend text if image was the failing part
                                 client.channels.cache.get(msg.channelId).send(messageToSend).catch(console.error);
                            }
                            return; // Exit this part of message processing
                        }

                        // Verification and Retry Loop Structure
                        let imageVerified = false;
                        let attempt = 1;
                        const MAX_RETRIES = 3;
                        let currentContent = messageToSend;
                        let currentImageBase64ForVerification = initialImageBase64;

                        while (attempt <= MAX_RETRIES && !imageVerified) {
                            console.log(`Verification attempt ${attempt}/${MAX_RETRIES} for image with prompt: "${SDPrompt}"`);
                            try {
                                const verificationPrompt = `Please carefully examine the attached image. Does it accurately depict the following scene or subject: '${SDPrompt}'? Respond with only the word YES or the word NO.`;
                                const ollamaVerificationResult = await getOllamaResponse(verificationPrompt, [], [currentImageBase64ForVerification]);
                                let ollamaAnswer = "";
                                if (ollamaVerificationResult && ollamaVerificationResult.response) {
                                    ollamaAnswer = ollamaVerificationResult.response.trim().toUpperCase();
                                }
                                console.log(`Ollama verification response: "${ollamaAnswer}"`);

                                if (ollamaAnswer === "YES") {
                                    console.log("Ollama verification successful (YES).");
                                    imageVerified = true;
                                    // If attempt > 1, postedMessage was already updated.
                                    // If attempt == 1, the original postedMessage is good.
                                    // Ensure content is up-to-date if it changed
                                    if (postedMessage.content !== currentContent && !postedMessage.deleted) {
                                        await postedMessage.edit({content: currentContent}).catch(e => console.error("Error editing message content to final state:", e));
                                    }
                                    break;
                                }

                                // If not "YES" (mismatch or unclear response from Ollama)
                                console.log(`Ollama verification failed or was not a clear YES (Attempt ${attempt}/${MAX_RETRIES})`);
                                if (attempt < MAX_RETRIES) {
                                    console.log("Attempting to generate a new image.");
                                    const newImageBase64 = await generateImage(SDPrompt);
                                    if (newImageBase64) {
                                        currentContent = `${messageToSend} (Updated image: The previous one wasn't quite right.)`;
                                        const newAttach = new AttachmentBuilder(Buffer.from(newImageBase64, "base64"), { name: "output.png" });
                                        
                                        try {
                                            if(postedMessage && !postedMessage.deleted) await postedMessage.delete();
                                        } catch (deleteError) {
                                            console.error("Error deleting previous message:", deleteError);
                                            // Proceed to post new one anyway, old one might linger.
                                        }
                                        
                                        postedMessage = await client.channels.cache.get(msg.channelId).send({
                                            content: currentContent,
                                            files: [newAttach]
                                        }).catch(err => {
                                            console.error("Error sending replacement image message:", err);
                                            if(postedMessage && !postedMessage.deleted) {
                                                 postedMessage.edit(currentContent + " (Error: Failed to post updated image.)").catch(console.error);
                                            } else {
                                                 msg.reply("I generated a new image but failed to post it after deleting the old one.").catch(console.error);
                                            }
                                            return; // Exit from messageCreate handler
                                        });
                                        if(!postedMessage) return; 

                                        currentImageBase64ForVerification = newImageBase64;
                                    } else {
                                        console.log("Failed to generate new image for replacement.");
                                        if (postedMessage && !postedMessage.deleted) {
                                            await postedMessage.edit(currentContent + " (I tried to generate a replacement, but it failed.)").catch(console.error);
                                        }
                                        imageVerified = true; 
                                        break;
                                    }
                                } else { 
                                    console.log("Max retries reached. Editing final message with a note.");
                                    if (postedMessage && !postedMessage.deleted) {
                                        // Ensure using potentially updated currentContent from a previous failed replacement
                                        const finalContent = (currentContent.includes("Updated image") || currentContent.includes("I tried")) 
                                                            ? currentContent 
                                                            : `${messageToSend} (I tried a few times to get a better one, but this was the best I could do.)`;
                                        await postedMessage.edit(finalContent).catch(console.error);
                                    }
                                    imageVerified = true; 
                                    break;
                                }
                            } catch (verificationError) { 
                                console.error("Error during verification/replacement attempt:", verificationError);
                                if (attempt < MAX_RETRIES) {
                                     console.log("Error during verification, treating as a failed attempt and trying to replace.");
                                     // The loop structure will increment attempt and retry generation if applicable
                                } else { 
                                    console.log("Max retries reached due to errors in verification loop. Editing final message.");
                                     if (postedMessage && !postedMessage.deleted) {
                                        const errorContent = (currentContent.includes("Updated image") || currentContent.includes("I tried")) 
                                                            ? currentContent 
                                                            : messageToSend;
                                        await postedMessage.edit(errorContent + " (I had trouble verifying the image, so I'll leave this one.)").catch(console.error);
                                    }
                                    imageVerified = true; 
                                    break;
                                }
                            }
                            attempt++; 
                        } // End of while loop

                    } else { // SDPrompt was empty
                        // Send text message if there is one (and no image was processed)
                        if (messageToSend) {
                            client.channels.cache.get(msg.channelId).send(messageToSend).catch(console.error);
                        }
                    }
                } else { // messageToSend did not include 'image attached'
                    // Standard text-only response
                    if (messageToSend) {
                         client.channels.cache.get(msg.channelId).send(messageToSend).catch(console.error);
                    }
                }
            }
            OllamaContext = ollamaResult.context; // Update context
        } else {
            console.log("Received an empty or invalid response from Ollama.");
        }
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
