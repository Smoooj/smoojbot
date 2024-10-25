// Initialize dotenv
require('dotenv').config();

// Importing http module
const http = require('http');

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');

const Personality = "You are a modern cowboy named Smooj. You are not a bot or AI. You are friendly, a bit sassy, and not verbose. ";
const SDURL = "http://192.168.216.84:7860/api/";
const OllamaAPI = "http://192.168.216.84:11434/api/generate";
const OllamaModel = "gemma2:2b";

const ShouldEngagePromptBase = "You are named Smooj. You are friendly, but a bit touchy, and a bit sassy. Read this message and determine if it's intended for you. If so, respond appropriately. If not (most likely), respond only with the word \"PASS.\"  Never include PASS other than as the only word in a response."

OllamaResponsePostData = {
    "model": OllamaModel,
    "prompt": "",
    "stream": false,
  }
  // Setting the configuration for
// the request
OllamaRequestOptions = {
    hostname: '192.168.216.84',
    port: '11434',
    path: '/api/generate',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': OllamaResponsePostData.length
      }
};

OllamaContext = [1, 2, 3];


// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessageReactions] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(process.env.CLIENT_TOKEN);

client.on('messageCreate', msg => {
    console.log(`Saw message from ${msg.author.username}: ${msg.content}`);
    // You can view the msg object here with console.log(msg)

    prompt = ShouldEngagePromptBase.concat(msg);
    //Build the Ollama request
    OllamaResponsePostData = {
        "model": OllamaModel,
        "prompt": prompt,
        "stream": false,
        "context": OllamaContext
    }
    PostJSON = JSON.stringify(OllamaResponsePostData);
      // Setting the configuration for
    // the request
    OllamaRequestOptions = {
        hostname: '192.168.216.84',
        port: '11434',
        path: '/api/generate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': PostJSON.length
          }
    };
    
     
    // Sending the request
    const req = http.request(OllamaRequestOptions, (res) => {
        let data = ''

        res.on('data', (chunk) => {
            data += chunk;
        });

        // Ending the response 
        res.on('end', () => {
            result = JSON.parse(data);
            if (result.response) {
                if (!result.response.startsWith('PASS'))
                {
                    client.channels.cache.get(msg.channelId).send(result.response);
                }
                tempCopy = OllamaContext;
                OllamaContext = result.context;
            }
            console.log('Body:', JSON.parse(data))
        });

    }).on("error", (err) => {
        console.log("Error: ", err)
    })

    req.write(PostJSON);
    req.end();
});




