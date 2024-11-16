const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Middleware for parsing requests
app.use(bodyParser.json());

// Function to verify Facebook Webhook
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

  // Ensure this is a page event
  if (body.object === "page") {
    body.entry.forEach((entry) => {
      // Handle messaging events
      if (entry.messaging) {
        entry.messaging.forEach((event) => {
          if (event.message && event.sender) {
            const senderId = event.sender.id;
            const receivedMessage = event.message.text;

            console.log(`Received message: ${receivedMessage} from user ${senderId}`);

            // Auto-reply to the user's message
            handleMessage(senderId, receivedMessage);
          }
        });
      }

      // Handle feed changes (like/follow events)
      if (entry.changes) {
        entry.changes.forEach((change) => {
          if (change.field === "feed" && change.value.verb === "add") {
            const senderId = change.value.from.id;
            const userName = change.value.from.name;

            const greeting = getTimeBasedGreeting();
            const message = `${greeting}, ${userName}! Thank you for following our page. 😊`;

            sendMessage(senderId, message);
          }
        });
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Function to reply to a user message
function handleMessage(senderId, receivedMessage) {
  let response;

  // Basic keyword-based response
  if (receivedMessage.toLowerCase() === "hi" || receivedMessage.toLowerCase() === "hello") {
    response = "Hello! 😊 How can I assist you today?";
  } else if (receivedMessage.toLowerCase().includes("help")) {
    response = "Sure! Let me know what you need help with.";
  } else {
    response = "Thank you for reaching out! We'll get back to you soon.";
  }

  // Send the response back to the user
  sendMessage(senderId, response);
}

// Function to get a time-based greeting
function getTimeBasedGreeting() {
  const now = new Date();
  const hours = now.getHours();

  if (hours < 12) return "Good Morning";
  if (hours < 18) return "Good Afternoon";
  return "Good Evening";
}

// Function to send a text message
function sendMessage(senderId, message) {
  const payload = {
    recipient: { id: senderId },
    message: { text: message },
  };

  request.post(
    {
      uri: `https://graph.facebook.com/v12.0/me/messages`,
      qs: { access_token: PAGE_ACCESS_TOKEN },
      json: payload,
    },
    (err, res, body) => {
      if (!err) {
        console.log("Message sent successfully!");
      } else {
        console.error("Error sending message:", err);
      }
    }
  );
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
