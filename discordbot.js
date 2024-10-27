// Initialize dotenv
require('dotenv').config();

// Importing http module
const http = require('http');

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');
const Discord = require('discord.js');

const Personality = "";
const SDURL = "http://192.168.216.84:7860/sdapi/v1/txt2img";
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
    prompt = encodeURIComponent(prompt);
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
                    message = result.response;
                    if (message.includes('image attached'))
                    {
                        message = result.response.split('image attached')[0];
                        SDPrompt = result.response.split('image attached')[1];
                        GetImageWithPrompt(SDPrompt, msg.channelId);
                    }
                    client.channels.cache.get(msg.channelId).send(message);
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


async function GetImageWithPrompt(SDprompt, channelID)
{

    
    //prompt = encodeURIComponent(prompt);
    SDPayload = {
        prompt: SDprompt,
        steps: 6,
        sampler_name: "DPM++ SDE",
        scheduler: "Karras",
        cfg_scale: 2,
        width: 768,
        height: 768,
    }
    SDData = JSON.stringify(SDPayload);

    SDRequestOptions = {
        hostname: '192.168.216.84',
        port: '7860',
        path: '/sdapi/v1/txt2img',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': SDData.length
          }
    };


    // Sending the request
    const req = http.request(SDRequestOptions, (res) => {
        let data = ''

        res.on('data', (chunk) => {
            data += chunk;
        });

        // Ending the response 
        res.on('end', () => {
            result = JSON.parse(data);
            if (result.images) {
                sfbuff = new Buffer.from(result.images[0], "base64");
                sfattach = new Discord.AttachmentBuilder(sfbuff, { name: "output.png" });
                client.channels.cache.get(channelID).send({files: sfattach});
            }
            console.log('Reply from SD:', data)
        });

    }).on("error", (err) => {
        console.log("Error: ", err)
    })

    req.write(SDData);
    req.end();

    /*
    //Trying a new, more modern method, fetch
    const result = await fetch('http://192.168.216.84:7860/sdapi/v1/txt2img', {
        method: 'POST',
        body: JSON.stringify({
            prompt: prompt,
            steps: 6,
            sampler_name: "DPM++ SDE",
            scheduler: "Karras",
            cfg_scale: 2,
            width: 768,
            height: 768,
        })
      }).then(res => res.json());
      console.log("SD Reply: ", result)
      result.images.forEach((img, i) => {
        const buf = Buffer.from(img, 'base64');
        const sfattach = new Discord.MessageAttachment(buf, "output.png");
        client.channels.cache.get(channelID).send(sfattach);
      });
*/
}
