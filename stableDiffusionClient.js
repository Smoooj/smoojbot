const http = require('http');

// Configuration from environment variables with defaults
const SD_HOSTNAME = process.env.SD_HOSTNAME || "192.168.216.84";
const SD_PORT = process.env.SD_PORT || "7860";
const SD_API_PATH = process.env.SD_API_PATH || "/sdapi/v1/txt2img";

async function generateImage(promptText) {
    return new Promise((resolve, reject) => {
        const SDPayload = {
            prompt: promptText,
            steps: 6,
            sampler_name: "DPM++ SDE",
            scheduler: "Karras",
            cfg_scale: 2,
            width: 768,
            height: 768,
        };
        const SDData = JSON.stringify(SDPayload);

        const SDRequestOptions = {
            hostname: SD_HOSTNAME,
            port: SD_PORT,
            path: SD_API_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(SDData)
            }
        };

        const req = http.request(SDRequestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.images && result.images.length > 0) {
                        resolve(result.images[0]); // Resolve with the first base64 image string
                    } else {
                        console.error("No images found in SD response or images array is empty in client.");
                        reject(new Error("No images received from Stable Diffusion service."));
                    }
                } catch (e) {
                    console.error("Error parsing Stable Diffusion response in client:", e);
                    console.error("Stable Diffusion Raw Response in client:", data);
                    reject(e);
                }
            });
        });

        req.on('error', (err) => {
            console.error("Stable Diffusion Error in client: ", err);
            reject(err);
        });

        req.write(SDData);
        req.end();
    });
}

module.exports = { generateImage };
