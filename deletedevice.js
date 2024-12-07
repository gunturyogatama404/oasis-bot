import fs from 'fs';
import axios from 'axios';

// Read authorization token from tokens.txt
let authToken;
try {
    authToken = fs.readFileSync('tokens.txt', 'utf8').trim();
    if (!authToken) {
        throw new Error("Token file is empty. Please add a valid token to tokens.txt.");
    }
} catch (error) {
    console.error(error.message || "File 'tokens.txt' not found. Please create the file and add your token.");
    process.exit(1);
}

// Set headers and base URL
const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'authorization': authToken, // Token read from file
    'content-type': 'application/json',
    'origin': 'https://dashboard.oasis.ai',
    'referer': 'https://dashboard.oasis.ai/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
};

const urlFetch = 'https://api.oasis.ai/internal/providerList,providerList,providerPointsTimeseries,settingsProfile?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22offset%22%3A0%2C%22limit%22%3A100%2C%22sortBy%22%3A%22latest%22%7D%7D%2C%221%22%3A%7B%22json%22%3A%7B%22offset%22%3A0%2C%22limit%22%3A100%2C%22sortBy%22%3A%22latest%22%7D%7D%2C%222%22%3A%7B%22json%22%3A%7B%22interval%22%3A%22week%22%7D%7D%2C%223%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D';

// Fetch data and extract IDs
axios.get(urlFetch, { headers })
    .then(response => {
        const data = response.data;

        // Recursive function to extract 'id' values
        const extractIds = (data) => {
            let ids = [];
            if (Array.isArray(data)) {
                data.forEach(item => {
                    ids = ids.concat(extractIds(item));
                });
            } else if (typeof data === 'object' && data !== null) {
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'id') {
                        ids.push(value);
                    } else if (typeof value === 'object') {
                        ids = ids.concat(extractIds(value));
                    }
                }
            }
            return ids;
        };

        const uniqueIds = [...new Set(extractIds(data))].sort();
        if (uniqueIds.length === 0) {
            console.error("No IDs found in the fetched data.");
            process.exit(1);
        }

        // Save IDs to a file
        fs.writeFileSync('id.txt', uniqueIds.join('\n'), 'utf8');
        console.log(`Unique IDs saved to id.txt:`, uniqueIds);

        // Read IDs from file and delete them
        const urlDelete = 'https://api.oasis.ai/internal/providerDelete?batch=1';
        Promise.all(uniqueIds.map(async (id) => {
            try {
                const deleteResponse = await axios.post(urlDelete, { "0": { "json": { "id": id } } }, { headers });
                if (deleteResponse.status === 200) {
                    console.log(`Successfully deleted ID ${id}`);
                } else {
                    console.error(`Failed to delete ID ${id}. HTTP Status: ${deleteResponse.status}`);
                }
            } catch (error) {
                console.error(`Failed to delete ID ${id}. Error: ${error.message}`);
            }
        })).then(() => {
            // Delete tokens.txt and providers.txt after deleting all IDs
            try {
                fs.unlinkSync('tokens.txt');
                console.log('Deleted tokens.txt successfully.');
            } catch (error) {
                console.error('Failed to delete tokens.txt:', error.message);
            }

            try {
                fs.unlinkSync('providers.txt');
                console.log('Deleted providers.txt successfully.');
            } catch (error) {
                console.error('Failed to delete providers.txt:', error.message);
            }
        });
    })
    .catch(error => {
        console.error(`Failed to fetch data. Error: ${error.response?.status || error.message}`);
        if (error.response?.data) {
            console.error(`Response Text: ${error.response.data}`);
        }
        process.exit(1);
    });
