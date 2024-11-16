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

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Function to get the current greeting based on the time
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

  if (mode && token === VERIFY_TOKEN) {
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
      if (entry.changes) {
        entry.changes.forEach((change) => {
          // Detect like/follow event
          if (change.field === "feed" && change.value.verb === "add") {
            const senderId = change.value.from.id; // User who liked/followed
            const userName = change.value.from.name; // User's name

            const greeting = getTimeBasedGreeting();
            const message = `${greeting}, ${userName}! Thank you for following our page. We truly appreciate your support. 😊`;

            // Send personalized greeting with an image
            sendMessageWithImage(senderId, message, "https://i.ibb.co/2cQVbcb");
          }
        });
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Function to send a message with an image via the Messenger API
function sendMessageWithImage(senderId, message, imageUrl) {
  const payload = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: imageUrl,
          is_reusable: true,
        },
      },
    },
  };

  const textPayload = {
    recipient: { id: senderId },
    message: { text: message },
  };

  // Send image first
  request.post(
    {
      uri: `https://graph.facebook.com/v12.0/me/messages`,
      qs: { access_token: PAGE_ACCESS_TOKEN },
      json: payload,
    },
    (err, res, body) => {
      if (err) {
        console.error("Unable to send image:", err);
      } else {
        console.log("Image sent successfully!");

        // Send the text message after the image
        request.post(
          {
            uri: `https://graph.facebook.com/v12.0/me/messages`,
            qs: { access_token: PAGE_ACCESS_TOKEN },
            json: textPayload,
          },
          (err, res, body) => {
            if (err) {
              console.error("Unable to send text message:", err);
            } else {
              console.log("Text message sent successfully!");
            }
          }
        );
      }
    }
  );
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
