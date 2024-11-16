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

      // Check if the event is a page follow or like
      if (event && event.sender) {
        const senderId = event.sender.id;

        // Fetch user details to send a personalized message
        getUserDetails(senderId, (username) => {
          const greeting = getTimeBasedGreeting();
          const message = `${greeting}, ${username}! Thank you for liking our page. 😊 Here's something special for you.`;

          // Send a message with an image
          sendMessageWithImage(senderId, message, "https://ibb.co/2cQVbcb");
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
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: message,
              image_url: imageUrl,
              subtitle: "We appreciate your support!",
              default_action: {
                type: "web_url",
                url: "https://auto-greetings.onrender.com", // Add your website here
              },
            },
          ],
        },
      },
    },
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
