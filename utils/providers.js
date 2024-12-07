import { generateRandomId } from "./system.js";
import { readToken, saveToken } from "./file.js";
import { logger } from "./logger.js";
import axios from 'axios';

// Set to track previously generated names to prevent duplicates
const generatedNames = new Set();

async function connectWithToken(token) {
    const url = 'https://api.oasis.ai/internal/authConnect?batch=1';
    let randomId, formattedName;

    // Ensure unique formattedName
    do {
        randomId = generateRandomId();
        formattedName = `Node${randomId}`;  // Format name with the random ID
    } while (generatedNames.has(formattedName));  // Check for duplicates

    // Add the unique name to the set of generated names
    generatedNames.add(formattedName);

    const payload = {
        "0": {
            "json": {
                "name": formattedName,
                "platform": "browser",
            }
        }
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token,  
    };

    try {
        const response = await axios.post(url, payload, { headers });
        const logToken = response.data[0].result.data.json;
        logger('Creating Providers successful:', logToken);
        return logToken;
    } catch (error) {
        logger('Creating Providers error:', error.response ? error.response.status : error.response.statusText, 'error');
        return null;
    }
}

export async function createProviders(numID) {
    try {
        const tokens = await readToken('tokens.txt');
        for (const token of tokens) { 
            logger(`Creating Providers using token: ${token}`);
            for (let i = 0; i < numID; i++) {
                logger(`Creating Providers #${i + 1}....`);
                const logToken = await connectWithToken(token);
                if (logToken) {
                    saveToken("providers.txt", logToken)
                } else {
                    logger('Failed to create provider', 'error', 'error');
                    continue;
                }
            };
        };
        return true;
    } catch (error) {
        logger("Error reading token or connecting:", error, 'error');
    };
};
