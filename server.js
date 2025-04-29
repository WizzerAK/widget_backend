const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

let accessToken = null;
let tokenCreatedAt = 0;
const tokenExpiry = 3600 * 1000; // 1 hour

async function getAccessToken() {
  const now = Date.now();

  if (!accessToken || now - tokenCreatedAt > tokenExpiry - 60000) {
    console.log("🔁 Refreshing access token...");

    const params = new URLSearchParams();
    params.append("refresh_token", process.env.ZOHO_REFRESH_TOKEN);
    params.append("client_id", process.env.ZOHO_CLIENT_ID);
    params.append("client_secret", process.env.ZOHO_CLIENT_SECRET);
    params.append("grant_type", "refresh_token");

    const response = await fetch("https://accounts.zoho.eu/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    const data = await response.json();

    if (data.access_token) {
      accessToken = data.access_token;
      tokenCreatedAt = now;
      console.log("✅ Access token refreshed successfully");
    } else {
      console.error("❌ Failed to refresh access token", data);
      throw new Error("Failed to refresh access token");
    }
  }

  return accessToken;
}

app.post("/api/schedule-calls", async (req, res) => {
  try {
    const { leadIds, start_time, call_owner, subject, purpose, agenda } = req.body;
    const token = await getAccessToken();

    console.log("📤 Sending payload to Zoho:", {
      leadid: leadIds.join("|||"),
      starttime: start_time,
      callowner: call_owner,
      callsubject: subject,
      callpurpose: purpose,
      callagenda: agenda
    });

    const zohoRes = await fetch("https://www.zohoapis.eu/crm/v2/functions/schedule_calls_bulk/actions/execute", {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        arguments: {
          leadid: leadIds.join("|||"),
          starttime: start_time,
          callowner: call_owner,
          callsubject: subject,
          callpurpose: purpose,
          callagenda: agenda
        }
      })
    });

    const result = await zohoRes.json();

    if (result.code === "SUCCESS") {
      res.json({ message: "✅ Calls scheduled successfully", result });
    } else {
      res.json({ message: "⚠️ Zoho API Error", result });
    }

  } catch (err) {
    console.error("❌ Server error", err);
    res.status(500).json({ message: "❌ Internal Server Error", error: err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
