// Initialize dotenv
require('dotenv').config();

// Importing http module
const http = require('http');

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');

const Personality = "";
const SDURL = "http://192.168.216.84:7860/api/";
const OllamaAPI = "http://192.168.216.84:11434/api/generate";
const OllamaModel = "Smooj";

const ShouldEngagePromptBase = "";

const SystemPrompt = ""

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

OllamaContext = [0];


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
    chatString = msg.author.displayName.concat(" says: ");
    prompt = chatString.concat(msg);

    //Build the Ollama request
    PostData = {
        "model": OllamaModel,
        "prompt": prompt,
        "stream": false,
        "context": OllamaContext
    }
    PostJSON = JSON.stringify(PostData);
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
                OllamaContext = result.context;
            }
            console.log('Body:', data)
        });

    }).on("error", (err) => {
        console.log("Error: ", err)
    })

    req.write(PostJSON);
    req.end();
});



