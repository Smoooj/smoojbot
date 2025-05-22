const http = require('http');

// Configuration from environment variables with defaults
const OLLAMA_HOSTNAME = process.env.OLLAMA_HOSTNAME || "192.168.216.84";
const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";
const OLLAMA_API_PATH = process.env.OLLAMA_API_PATH || "/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "Smooj";

// Base request options for Ollama. Content-Length will be added dynamically.
const baseOllamaRequestOptions = {
    hostname: OLLAMA_HOSTNAME,
    port: OLLAMA_PORT,
    path: OLLAMA_API_PATH,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

async function getOllamaResponse(prompt, context, images) {
    return new Promise((resolve, reject) => {
        const PostData = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": false,
            "context": context
        };

        if (images && images.length > 0) {
            PostData.images = images;
        }

        const PostJSON = JSON.stringify(PostData);

        const currentOllamaRequestOptions = {
            ...baseOllamaRequestOptions,
            headers: {
                ...baseOllamaRequestOptions.headers,
                'Content-Length': Buffer.byteLength(PostJSON)
            }
        };

        const req = http.request(currentOllamaRequestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    console.error("Error parsing Ollama response in client:", e);
                    console.error("Ollama Raw Response in client:", data);
                    reject(e); // Reject the promise on parsing error
                }
            });
        });

        req.on('error', (err) => {
            console.error("Ollama Error in client: ", err);
            reject(err); // Reject the promise on request error
        });

        req.write(PostJSON);
        req.end();
    });
}

module.exports = { getOllamaResponse };
