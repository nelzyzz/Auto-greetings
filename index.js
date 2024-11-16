const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const crypto = require("crypto");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;

// Middleware for parsing requests
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Function to verify the request signature from Facebook
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    console.warn("No signature found.");
  } else {
    const hash = crypto
      .createHmac("sha256", APP_SECRET)
      .update(buf)
      .digest("hex");
    const expectedSignature = `sha256=${hash}`;
    if (signature !== expectedSignature) {
      throw new Error("Request signature validation failed.");
    }
  }
}

// Function to get the current greeting based on time
function getTimeBasedGreeting() {
  const now = new Date();
  const hours = now.getHours();

  if (hours < 12) return "Good Morning";
  if (hours < 18) return "Good Afternoon";
  return "Good Evening";
}

// Webhook Verification Endpoint
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully.");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});

// Webhook Event Handler
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      // Log incoming events
      console.log("Webhook Event:", JSON.stringify(entry));

      // Handle specific changes (like/follow events)
      if (entry.changes) {
        entry.changes.forEach((change) => {
          // Detect follow event
          if (change.field === "feed" && change.value.verb === "add") {
            const senderId = change.value.from.id;
            const userName = change.value.from.name;

            const greeting = getTimeBasedGreeting();
            const message = `${greeting}, ${userName}! Thank you for following our page. We’re excited to connect with you! 😊`;

            // Send a simple thank you message (no buttons)
            sendSimpleMessage(senderId, message);
          }
        });
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Function to send a simple text message
function sendSimpleMessage(senderId, message) {
  const payload = {
    recipient: { id: senderId },
    message: {
      text: message,
    },
  };

  request.post(
    {
      uri: `https://graph.facebook.com/v12.0/me/messages`,
      qs: { access_token: PAGE_ACCESS_TOKEN },
      json: payload,
    },
    (err, res, body) => {
      if (err) {
        console.error("Error sending message:", err);
      } else {
        console.log("Message sent successfully!");
      }
    }
  );
}

// Function to handle errors
app.use((err, req, res, next) => {
  console.error("Error occurred:", err.message);
  res.status(500).send({ error: "Something went wrong!" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
