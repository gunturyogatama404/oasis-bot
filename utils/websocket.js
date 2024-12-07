import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import { generateRandomId, generateRandomSystemData } from "./system.js";
import { delay } from "./file.js";
import { logger } from "./logger.js";

export async function createConnection(token, proxy = null) {
    const wsOptions = {};

    if (proxy) {
        // Validate and format proxy URL, if invalid, skip proxy setup and delete proxy
        const formattedProxy = formatProxyUrl(proxy);
        if (formattedProxy) {
            logger(`Connect Using proxy: ${formattedProxy}`);
            wsOptions.agent = new HttpsProxyAgent(formattedProxy);
        } else {
            logger(`Invalid proxy URL provided: ${proxy}`, "error");
            // Proxy is invalid, delete it from wsOptions
            delete wsOptions.agent;
            // Optionally, log that proxy is being skipped
            logger("Skipping proxy setup due to invalid URL", "warn");
        }
    }

    try {
        const socket = new WebSocket(`wss://ws.oasis.ai/?token=${token}`, wsOptions);

        socket.on("open", async () => {
            logger(`WebSocket connection established for providers: ${token.substring(0, 8)}...`, "", "success");
            const randomId = generateRandomId();
            const systemData = generateRandomSystemData();

            socket.send(JSON.stringify(systemData));
            await delay(2000);

            // Send the initial heartbeat with the proxy information included
            sendHeartbeat(socket, randomId, token, proxy);

            setInterval(() => {
                const randomId = generateRandomId();
                sendHeartbeat(socket, randomId, token, proxy);
            }, 60000);
        });

        socket.on("message", (data) => {
            const message = data.toString();
            try {
                const parsedMessage = JSON.parse(message);
                if (parsedMessage.type === "serverMetrics") {
                    const { totalEarnings, totalUptime, creditsEarned } = parsedMessage.data;
                    // logger(`Heartbeat sent for provider: ${token}`);
                    // logger(`Total uptime: ${totalUptime} seconds | Credits earned:`, creditsEarned);
                } else if (parsedMessage.type === "acknowledged") {
                    logger("System Updated:", message, "warn");
                } else if (parsedMessage.type === "error" && parsedMessage.data.code === "Invalid body") {
                    const systemData = generateRandomSystemData();
                    socket.send(JSON.stringify(systemData));
                }
            } catch (error) {
                logger("Error parsing message:", "error");
            }
        });

        socket.on("close", () => {
            logger("WebSocket connection closed for token:", token, "warn");
            setTimeout(() => {
                logger("Attempting to reconnect for token:", token, "warn");
                createConnection(token, proxy); 
            }, 5000);
        });

        socket.on("error", (error) => {
            logger("WebSocket error for token:", token, "error");
        });

    } catch (error) {
        logger(`Error in creating WebSocket connection for token ${token.substring(0, 8)}...: ${error.message}`, "error");
    }
}

function sendHeartbeat(socket, randomId, token, proxy) {
    logger(`[Heartbeat] Sending heartbeat for provider: ${token.substring(0, 8)}... via proxy: ${proxy || 'No proxy'}`);

    socket.send(
        JSON.stringify({
            id: randomId,
            type: "heartbeat",
            data: {
                version: "0.1.7",
                mostRecentModel: "unknown",
                status: "active",
            },
        })
    );
}

function formatProxyUrl(proxy) {
    // Validate the proxy URL using a regular expression to check its structure
    const urlPattern = /^(http|https):\/\/[^\s$.?#].[^\s]*$/i; // Regex to validate URLs

    if (urlPattern.test(proxy)) {
        return proxy; // Valid URL, return as is
    }

    return null; // Invalid URL format
}
