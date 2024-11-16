const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();

// Environment variables
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Function to determine the greeting based on the time of day
function getTimeBasedGreeting() {
  const currentHour = new Date().getHours();
  if (currentHour < 12) return "Good Morning";
  if (currentHour < 18) return "Good Afternoon";
  return "Good Evening";
}

// Function to fetch user details from Facebook Graph API
function getUserDetails(senderId, callback) {
  const url = `https://graph.facebook.com/${senderId}?fields=first_name&access_token=${PAGE_ACCESS_TOKEN}`;
  request.get(url, (err, res, body) => {
    if (err) {
      console.error("Error fetching user details:", err);
      callback(null);
    } else {
      const user = JSON.parse(body);
      callback(user.first_name || "there");
    }
  });
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
      const event = entry.messaging ? entry.messaging[0] : null;

      if (event && event.sender) {
        const senderId = event.sender.id;

        // Fetch the user's first name and send a personalized greeting
        getUserDetails(senderId, (username) => {
          const greeting = getTimeBasedGreeting();
          const message = `${greeting}, ${username}! Thank you for liking our page. We're here to help. 😊`;
          sendMessage(senderId, message);
        });
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Function to send messages via Messenger API
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
        console.log("Message sent successfully:", message);
      } else {
        console.error("Unable to send message:", err);
      }
    }
  );
}

// Start the server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
