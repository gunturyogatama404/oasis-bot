import { readToken, delay } from "./utils/file.js";
import { createConnection } from "./utils/websocket.js";
import { showBanner } from "./utils/banner.js";

// Shuffle function to randomize the proxies
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

async function start() {
    showBanner();
    const tokens = await readToken("providers.txt");
    const proxies = await readToken("proxy.txt");

    if (proxies.length < tokens.length) {
        logger("Not enough proxies for the number of Providers. Exiting...");
        return;
    }

    // Shuffle proxies to ensure each token gets a different IP
    shuffleArray(proxies);

    // Create connections with 1 proxy per token (after shuffling)
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const proxy = proxies[i];

        await createConnection(token, proxy);
    }
}

start();
