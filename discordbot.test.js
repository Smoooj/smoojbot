// discordbot.test.js

jest.mock('./stableDiffusionClient.js');
jest.mock('./ollamaClient.js');

const { generateImage } = require('./stableDiffusionClient.js');
const { getOllamaResponse } = require('./ollamaClient.js');

// Mock Discord message and client functionalities
const mockDelete = jest.fn();
const mockEdit = jest.fn();
const mockSend = jest.fn(); // For channel.send

// global mock for initially posted message and its replacements
let currentMockPostedMessage; 

const mockClient = {
    channels: {
        cache: {
            // channel.send will be set via mockSend which returns currentMockPostedMessage
            get: jest.fn().mockReturnValue({ send: mockSend }) 
        }
    },
    once: jest.fn(),
    on: jest.fn(),
    login: jest.fn()
};

jest.mock('discord.js', () => ({
    ...jest.requireActual('discord.js'),
    Client: jest.fn(() => mockClient),
    GatewayIntentBits: { Guilds: 'Guilds', GuildMessages: 'GuildMessages', MessageContent: 'MessageContent', DirectMessageReactions: 'DirectMessageReactions' },
    AttachmentBuilder: jest.fn().mockImplementation((buffer, options) => ({ buffer, options }))
}));

describe('Discord Bot - Post, Verify, and Replace Logic', () => {
    let messageCreateCallback;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CLIENT_TOKEN = 'test_token';
        
        // Reset modules to ensure discordbot.js is re-evaluated with fresh mocks
        jest.resetModules();
        require('./discordbot.js');

        const onCall = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate');
        if (!onCall) throw new Error("messageCreate handler not registered");
        messageCreateCallback = onCall[1];

        // Default mock for the initial Ollama call (command parsing)
        getOllamaResponse.mockResolvedValue({ response: "PASS", context: [1] });

        // Setup mockSend to return a message object with mockable delete/edit
        currentMockPostedMessage = { 
            delete: mockDelete, 
            edit: mockEdit,
            content: "", // Keep track of content for assertions if needed
            deleted: false // Simulate message state
        };
        // Make channel.send return this mockable message structure
        mockSend.mockImplementation(async (options) => {
            // Simulate that mockDelete makes message.deleted true
            mockDelete.mockImplementation(async () => {
                currentMockPostedMessage.deleted = true;
                return currentMockPostedMessage;
            });
            // Simulate edit updating content
            mockEdit.mockImplementation(async (newContent) => {
                if(typeof newContent === 'object' && newContent.content) {
                    currentMockPostedMessage.content = newContent.content;
                } else if (typeof newContent === 'string') {
                     currentMockPostedMessage.content = newContent;
                }
                return currentMockPostedMessage;
            });
            // For a new message, reset deleted state
            currentMockPostedMessage.deleted = false; 
            if(options && options.content) currentMockPostedMessage.content = options.content;
            return currentMockPostedMessage;
        });
    });

    const mockMsg = {
        author: { bot: false, username: 'user', displayName: 'User' },
        content: "test message",
        channelId: "testchannel",
        attachments: new Map(),
        reply: jest.fn() // General reply mock for error messages not related to postedMessage
    };

    it('Scenario 1: Initial image posted, verification PASS', async () => {
        const sdPrompt = "A perfect image";
        const imageBase64 = "perfectImageBase64";
        
        getOllamaResponse.mockResolvedValueOnce({ response: `Generate: image attached ${sdPrompt}`, context: [1] }); // Initial command
        generateImage.mockResolvedValueOnce(imageBase64); // Initial generation
        getOllamaResponse.mockResolvedValueOnce({ response: "YES", context: [2] }); // Verification

        await messageCreateCallback(mockMsg);

        expect(mockSend).toHaveBeenCalledTimes(1); // Initial post
        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockEdit).not.toHaveBeenCalled(); // Or verify it's called to set final content if logic does that
        expect(generateImage).toHaveBeenCalledTimes(1);
        expect(getOllamaResponse).toHaveBeenCalledTimes(2); // Command + Verification
    });

    it('Scenario 2: First image bad (NO), second image good (YES)', async () => {
        const sdPrompt = "A tricky image";
        const badImage = "badImageBase64";
        const goodImage = "goodImageBase64";

        getOllamaResponse.mockResolvedValueOnce({ response: `Generate: image attached ${sdPrompt}`, context: [1] }); // Command
        generateImage.mockResolvedValueOnce(badImage); // 1st gen
        getOllamaResponse.mockResolvedValueOnce({ response: "NO", context: [2] }); // 1st verification
        generateImage.mockResolvedValueOnce(goodImage); // 2nd gen
        getOllamaResponse.mockResolvedValueOnce({ response: "YES", context: [3] }); // 2nd verification
        
        await messageCreateCallback(mockMsg);

        expect(mockSend).toHaveBeenCalledTimes(2); // Initial post + Replacement post
        expect(mockDelete).toHaveBeenCalledTimes(1); // Delete the first message
        expect(mockEdit).not.toHaveBeenCalled(); // Final message (good) should not be edited with failure/apology
        expect(generateImage).toHaveBeenCalledTimes(2);
        expect(getOllamaResponse).toHaveBeenCalledTimes(3); // Command + 2 Verifications
        expect(mockSend.mock.calls[1][0].content).toContain("Updated image: The previous one wasn't quite right.");
    });

    it('Scenario 3: All retries fail (verification consistently NO)', async () => {
        const sdPrompt = "An impossible image";
        getOllamaResponse.mockResolvedValueOnce({ response: `Generate: image attached ${sdPrompt}`, context: [1] }); // Command
        generateImage.mockResolvedValue("someImageBase64"); // All generations succeed
        // All verifications fail
        getOllamaResponse.mockResolvedValueOnce({ response: "NO", context: [2] }); // Verif 1
        getOllamaResponse.mockResolvedValueOnce({ response: "NO", context: [3] }); // Verif 2
        getOllamaResponse.mockResolvedValueOnce({ response: "NO", context: [4] }); // Verif 3

        await messageCreateCallback(mockMsg);

        expect(mockSend).toHaveBeenCalledTimes(3); // Initial + 2 replacements
        expect(mockDelete).toHaveBeenCalledTimes(2); // Delete first, then second
        expect(mockEdit).toHaveBeenCalledTimes(1); // Edit the 3rd message
        expect(mockEdit.mock.calls[0][0]).toContain("best I could do");
        expect(generateImage).toHaveBeenCalledTimes(3);
        expect(getOllamaResponse).toHaveBeenCalledTimes(4); // Command + 3 Verifications
    });
    
    it('Scenario 4: Image generation fails during a retry', async () => {
        const sdPrompt = "An image that fails mid-way";
        getOllamaResponse.mockResolvedValueOnce({ response: `Generate: image attached ${sdPrompt}`, context: [1] }); // Command
        generateImage.mockResolvedValueOnce("firstImageBase64"); // 1st gen
        getOllamaResponse.mockResolvedValueOnce({ response: "NO", context: [2] }); // 1st verification fails
        generateImage.mockRejectedValueOnce(new Error("Failed to generate replacement")); // 2nd gen fails

        await messageCreateCallback(mockMsg);

        expect(mockSend).toHaveBeenCalledTimes(1); // Only initial post
        expect(mockDelete).not.toHaveBeenCalled(); 
        expect(mockEdit).toHaveBeenCalledTimes(1); // Edit the 1st message
        expect(mockEdit.mock.calls[0][0]).toContain("I tried to generate a replacement, but it failed.");
        expect(generateImage).toHaveBeenCalledTimes(2); // Attempted initial and one replacement
        expect(getOllamaResponse).toHaveBeenCalledTimes(2); // Command + 1 Verification
    });

    it('Scenario 5: Ollama verification call itself fails on first attempt, then succeeds', async () => {
        const sdPrompt = "Image with flaky verification";
        const firstImage = "firstImage64";
        const secondImage = "secondImage64";

        getOllamaResponse.mockResolvedValueOnce({ response: `Generate: image attached ${sdPrompt}`, context: [1] }); // Command
        generateImage.mockResolvedValueOnce(firstImage); // 1st gen
        getOllamaResponse.mockRejectedValueOnce(new Error("Ollama network error during verification")); // 1st verification fails with error
        generateImage.mockResolvedValueOnce(secondImage); // 2nd gen (triggered by error in 1st verif)
        getOllamaResponse.mockResolvedValueOnce({ response: "YES", context: [3] }); // 2nd verification is YES

        await messageCreateCallback(mockMsg);
        
        expect(mockSend).toHaveBeenCalledTimes(2); // Initial Post + Replacement Post
        expect(mockDelete).toHaveBeenCalledTimes(1); // Delete initial message due to verification error
        expect(mockEdit).not.toHaveBeenCalled(); // The second message is good, no apology edit.
        expect(generateImage).toHaveBeenCalledTimes(2);
        expect(getOllamaResponse).toHaveBeenCalledTimes(3); // Command + 2 Verifications (one failed, one success)
        expect(mockSend.mock.calls[1][0].content).toContain("Updated image: The previous one wasn't quite right.");
    });
    
    it('Scenario 6: All retries fail due to Ollama verification errors', async () => {
        const sdPrompt = "Image with persistent verification errors";
        getOllamaResponse.mockResolvedValueOnce({ response: `Generate: image attached ${sdPrompt}`, context: [1] }); // Command
        generateImage.mockResolvedValue("someImageBase64"); // All image generations work

        // All verification attempts fail with errors
        getOllamaResponse.mockRejectedValueOnce(new Error("Ollama Verif Error 1")); 
        getOllamaResponse.mockRejectedValueOnce(new Error("Ollama Verif Error 2")); 
        getOllamaResponse.mockRejectedValueOnce(new Error("Ollama Verif Error 3")); 

        await messageCreateCallback(mockMsg);

        expect(mockSend).toHaveBeenCalledTimes(3); // Initial + 2 replacements (as errors are treated like "NO" for retry purposes)
        expect(mockDelete).toHaveBeenCalledTimes(2);
        expect(mockEdit).toHaveBeenCalledTimes(1); // Edit the 3rd message
        expect(mockEdit.mock.calls[0][0]).toContain("I had trouble verifying the image, so I'll leave this one.");
        expect(generateImage).toHaveBeenCalledTimes(3);
        expect(getOllamaResponse).toHaveBeenCalledTimes(4); // Command + 3 failed verifications
    });


});
