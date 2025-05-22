// ollamaClient.test.js

// Mocking the http module
jest.mock('http', () => ({
  request: jest.fn((options, callback) => {
    const req = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    // Simulate a basic successful response for JSON parsing
    const res = {
      on: jest.fn((event, cb) => {
        if (event === 'data') {
          // Simulate receiving a chunk of data
          cb(JSON.stringify({ response: 'mock response', context: [1,2,3] }));
        }
        if (event === 'end') {
          // Simulate the end of the response
          cb();
        }
      }),
      statusCode: 200,
      headers: {},
    };
    // Call the callback with the mock response
    callback(res);
    return req;
  }),
}));

const { getOllamaResponse } = require('./ollamaClient.js'); // Assuming ollamaClient.js is in the same directory
const http = require('http');

describe('ollamaClient', () => {
  describe('getOllamaResponse', () => {
    let mockRequestWrite;
    let mockRequestEnd;
    let mockRequestOnError;

    beforeEach(() => {
      // Reset mocks for each test
      jest.clearAllMocks();

      // Setup mock implementations for http.request
      // This allows us to spy on what's being sent.
      mockRequestWrite = jest.fn();
      mockRequestEnd = jest.fn();
      mockRequestOnError = jest.fn(); // To potentially simulate errors

      http.request.mockImplementation((options, callback) => {
        const req = {
          on: (event, cb) => {
            if (event === 'error') {
              mockRequestOnError = cb; // Capture the error handler
            }
          },
          write: mockRequestWrite,
          end: mockRequestEnd,
        };
        const res = {
          on: (event, cb) => {
            if (event === 'data') {
              cb(JSON.stringify({ response: 'mock success', context: [1, 2, 3] }));
            }
            if (event === 'end') {
              cb();
            }
          },
          statusCode: 200,
        };
        callback(res);
        return req;
      });
    });

    test('should send a request without the images field when no images are provided', async () => {
      const prompt = 'Test prompt';
      const context = [0];

      await getOllamaResponse(prompt, context);

      expect(http.request).toHaveBeenCalledTimes(1);
      expect(mockRequestWrite).toHaveBeenCalledTimes(1);

      // Spy on the PostData written to the request
      const postDataSent = JSON.parse(mockRequestWrite.mock.calls[0][0]);
      
      expect(postDataSent.prompt).toBe(prompt);
      expect(postDataSent.context).toEqual(context);
      expect(postDataSent.model).toBe(process.env.OLLAMA_MODEL || "Smooj"); // Check model is included
      expect(postDataSent.stream).toBe(false); // Check stream is false
      expect(postDataSent).not.toHaveProperty('images');
      expect(mockRequestEnd).toHaveBeenCalledTimes(1);
    });

    test('should include the images field in PostData when image data is passed', async () => {
      const prompt = 'Test prompt with image';
      const context = [1, 2];
      const images = ['base64mockimage123'];

      await getOllamaResponse(prompt, context, images);

      expect(http.request).toHaveBeenCalledTimes(1);
      expect(mockRequestWrite).toHaveBeenCalledTimes(1);

      // Spy on the PostData written to the request
      const postDataSent = JSON.parse(mockRequestWrite.mock.calls[0][0]);

      expect(postDataSent.prompt).toBe(prompt);
      expect(postDataSent.context).toEqual(context);
      expect(postDataSent.images).toEqual(images);
      expect(postDataSent.images.length).toBe(1);
      expect(postDataSent.images[0]).toBe('base64mockimage123');
      expect(postDataSent.model).toBe(process.env.OLLAMA_MODEL || "Smooj");
      expect(postDataSent.stream).toBe(false);
      expect(mockRequestEnd).toHaveBeenCalledTimes(1);
    });

    test('should handle http request errors', async () => {
        const prompt = 'Test prompt for error';
        const context = [0];
        const MOCK_ERROR = new Error('Network failure');

        http.request.mockImplementationOnce((options, callback) => {
            const req = {
                on: (event, cb) => {
                    if (event === 'error') {
                        // Simulate an error event
                        cb(MOCK_ERROR);
                    }
                },
                write: jest.fn(),
                end: jest.fn(),
            };
            return req;
        });

        await expect(getOllamaResponse(prompt, context)).rejects.toThrow('Network failure');
        expect(http.request).toHaveBeenCalledTimes(1);
    });

    test('should handle error during JSON parsing of the response', async () => {
        const prompt = 'Test prompt for parse error';
        const context = [0];

        http.request.mockImplementationOnce((options, callback) => {
            const req = {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn(),
            };
            const res = {
                on: (event, cb) => {
                    if (event === 'data') {
                        cb("This is not valid JSON"); // Simulate invalid JSON
                    }
                    if (event === 'end') {
                        cb();
                    }
                },
                statusCode: 200,
            };
            callback(res);
            return req;
        });
        
        // We need to catch the rejection of the promise
        await expect(getOllamaResponse(prompt, context)).rejects.toThrow();
    });

  });
});

/*
Conceptual Outline for Mocking http.request:

1.  **`jest.mock('http')`**: At the top level of the test file, use Jest's `jest.mock('http')` function.
2.  **Mock `http.request`**:
    *   Inside the factory function of `jest.mock`, return an object where `request` is a `jest.fn()`.
    *   This mock `request` function will need to simulate the behavior of the real `http.request`. It takes `options` and a `callback` as arguments.
    *   It should return a mock `req` object. This object needs to have `on`, `write`, and `end` methods, also as `jest.fn()`.
    *   The `callback` passed to `http.request` is for the `res` (response) object. The mock `request` function should invoke this `callback` with a mock `res` object.
    *   The mock `res` object needs an `on` method (a `jest.fn()`) to simulate 'data' and 'end' events.
3.  **Spying on Data**:
    *   In your test cases, before calling `getOllamaResponse`, you can access `http.request` (which is now the mock).
    *   To check the data written:
        *   When `http.request` is called, the mock `req.write` function will be invoked.
        *   You can assert that `req.write` was called with the expected `PostJSON` string.
        *   `JSON.parse(mockReqWrite.mock.calls[0][0])` can be used to get the actual `PostData` object sent.
    *   Example:
        ```javascript
        // Inside a test
        const mockHttp = require('http'); // This will be the mocked version
        // ... call getOllamaResponse ...
        
        // Assuming your mock http.request returns a req object with a write spy
        // This part is tricky because the actual req object is created inside the mock.
        // A common pattern is to have the mock http.request store its created req objects
        // or make the write function a spy that's accessible from the test.

        // A more robust way (as implemented above with beforeEach):
        // In beforeEach, http.request is mocked to use a specific jest.fn() for write.
        // Then, in the test:
        // expect(mockRequestWrite).toHaveBeenCalledWith(expectedJsonString);
        // const sentData = JSON.parse(mockRequestWrite.mock.calls[0][0]);
        // expect(sentData.images).toEqual(images);
        ```
4.  **Simulating Response**:
    *   The mock `res.on('data', callback)` should call its `callback` with a chunk of stringified JSON (simulating the Ollama API response).
    *   The mock `res.on('end', callback)` should call its `callback`.
5.  **Error Handling**:
    *   To test error handling, the mock `req.on('error', callback)` can be made to call its `callback` with a mock error object.
*/
