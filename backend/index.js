const express = require("express");
const Airtable = require("airtable");
const dotenv = require("dotenv");
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const path = require("path");
const { receiveMessageOnPort } = require("worker_threads");
dotenv.config();

const app = express();
const port = 3000;
// parse JSON bodies
app.use(express.json());
// 1. Configure Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(
    process.env.AIRTABLE_BASE_ID
);

// Helper: verify a slack_id exists in the Printers table and return the printer record
async function findPrinterBySlackId(slackId) {
    if (!process.env.AIRTABLE_TABLE_ID) return null;
    try {
        const records = await base(process.env.AIRTABLE_TABLE_ID)
            .select({
                filterByFormula: `{slack_id} = "${slackId}"`,
                maxRecords: 1,
            })
            .all();
        if (!records || !records.length) return null;
        return records[0];
    } catch (err) {
        console.error('Error querying Printers table for slack_id', slackId, err && (err.stack || err.message || err));
        return null;
    }
}

// Middleware: authenticate and authorize printers via JWT and Airtable lookup
async function printerAuth(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization header' });
        const token = auth.slice('Bearer '.length).trim();
        if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Server not configured for auth' });
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (!payload || payload.role !== 'printer' || !payload.slack_id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // verify the slack_id exists in Airtable printers table
        const printerRecord = await findPrinterBySlackId(payload.slack_id);
        if (!printerRecord) return res.status(403).json({ error: 'Printer not registered' });

        req.printer = {
            slack_id: payload.slack_id,
            name: printerRecord.get('Display Name') || payload.name || null,
            airtableRecordId: printerRecord.id,
        };
        next();
    } catch (err) {
        console.error('printerAuth error', err && (err.stack || err.message || err));
        res.status(500).json({ error: 'Authentication error' });
    }
}

app.get("/api/printers", async (req, res) => {
    // Ensure Airtable is configured
    if (!process.env.AIRTABLE_KEY || !process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_TABLE_ID) {
        console.error('Airtable not configured (AIRTABLE_KEY/AIRTABLE_BASE_ID/AIRTABLE_TABLE_ID).');
        return res.status(500).json({ error: 'Airtable not configured' });
    }

    try {
        const records = await base(process.env.AIRTABLE_TABLE_ID)
            .select({
                fields: [
                    "slack_id",
                    "Display Name",
                    "Profile Picture",
                    "website",
                    "Bio",
                    "Country",
                ], // Your actual field names
            })
            .all();
        const printers = records.map((record) => ({
            slack_id: record.get("slack_id"),
            nickname: record.get("Display Name"),
            profile_pic: record.get("Profile Picture")?.[0]?.url || null, // First attachment URL
            website: record.get("website"),
            bio: record.get("Bio"),
            country: record.get("Country"), // Assuming you have a 'Country' field
        }));
        res.json(printers);
    } catch (error) {
        console.error("Error fetching printers:", error && (error.stack || error.message || error));
        res.status(500).json({ error: "Failed to fetch printers" });
    }
});

// --- Slack OAuth routes ---
// Redirect user to Slack for OAuth
app.get('/auth/slack/start', (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirect = process.env.SLACK_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/slack/callback';
    if (!clientId) return res.status(500).send('Slack not configured');
    const scope = encodeURIComponent('users:read');
    const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirect)}`;
    res.redirect(url);
});

// OAuth callback: exchange code for token and create JWT
app.get('/auth/slack/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) return res.status(400).send('Missing code');
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        const redirect = process.env.SLACK_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/slack/callback';
        if (!clientId || !clientSecret) return res.status(500).send('Slack not configured');

        const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirect,
            })
        });
        const tokenJson = await tokenRes.json();
        if (!tokenJson || !tokenJson.ok) {
            console.error('Slack oauth error', tokenJson);
            return res.status(500).send('Slack OAuth failed');
        }

        // tokenJson.authed_user.id contains the Slack user id (for classic apps, use different path)
        const slackId = tokenJson.authed_user && tokenJson.authed_user.id;
        if (!slackId) return res.status(500).send('Slack did not return user id');

        // Try to fetch the user's profile (display name) using the authed_user token
        let displayName = null;
        try {
            const userToken = (tokenJson.authed_user && tokenJson.authed_user.access_token) || tokenJson.access_token;
            if (userToken) {
                const infoUrl = `https://slack.com/api/users.info?user=${encodeURIComponent(slackId)}`;
                const infoRes = await fetch(infoUrl, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${userToken}` }
                });
                const infoJson = await infoRes.json();
                console.log('Slack users.info response:', infoJson);
                if (infoJson && infoJson.ok && infoJson.user) {
                    displayName = infoJson.user.profile.display_name || infoJson.user.real_name || infoJson.user.name || null;
                } else {
                    console.warn('Slack users.info failed:', infoJson);
                }
            } else {
                console.warn('No user token available for users.info');
            }
        } catch (err) {
            console.warn('Could not fetch Slack user profile', err && (err.stack || err.message || err));
        }

        // Check whether the user is a registered printer
        const printerRecord = await findPrinterBySlackId(slackId);
        const role = printerRecord ? 'printer' : 'user';

        console.log(`OAuth completed for slack_id=${slackId}, displayName=${displayName}, role=${role}`);

        // Issue JWT
        if (!process.env.JWT_SECRET) return res.status(500).send('Server JWT not configured');
        const payload = { slack_id: slackId, role, name: displayName };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        // Redirect to client UI with token as query parameter
        // The frontend will extract the token and store it in localStorage
        const clientRedirect = process.env.ADMIN_UI_REDIRECT || '/';
        const redirectUrl = `${clientRedirect}?token=${encodeURIComponent(token)}`;
        console.log('Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Slack callback error', err && (err.stack || err.message || err));
        res.status(500).send('OAuth callback error');
    }
});

// General auth middleware: verifies JWT and attaches req.user
function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization || req.query.token || (req.headers.cookie && req.headers.cookie.includes('pl_token'));
        let token = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.slice('Bearer '.length).trim();
        } else if (req.query && req.query.token) {
            token = req.query.token;
        } else if (req.headers.cookie) {
            // try to parse cookie pl_token
            const match = req.headers.cookie.match(/pl_token=([^;]+)/);
            if (match) token = match[1];
        }
        if (!token) return res.status(401).json({ error: 'Missing token' });
        if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Server not configured for auth' });
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = { slack_id: payload.slack_id, role: payload.role, name: payload.name || null };
        next();
    } catch (err) {
        console.error('requireAuth error', err && (err.stack || err.message || err));
        res.status(500).json({ error: 'Authentication error' });
    }
}

// GET current user info
app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const isPrinter = !!(await findPrinterBySlackId(req.user.slack_id));
        return res.json({ slack_id: req.user.slack_id, name: req.user.name, role: isPrinter ? 'printer' : 'user' });
    } catch (err) {
        console.error('Error in /api/me', err && (err.stack || err.message || err));
        return res.status(500).json({ error: 'Failed to retrieve user' });
    }
});

// --- Protected admin endpoints ---
// GET /api/requests - list requests (only printers)
app.get('/api/requests', printerAuth, async (req, res) => {
    try {
        // If Airtable requests table configured, fetch from Airtable
        if (process.env.AIRTABLE_REQUESTS_TABLE_ID) {
            const records = await base(process.env.AIRTABLE_REQUESTS_TABLE_ID)
                .select({
                    sort: [{ field: 'ReceivedAt', direction: 'desc' }],
                })
                .all();
            const requests = records.map(r => ({ id: r.id, ...r.fields }));
            return res.json(requests);
        }

        // otherwise return in-memory list
        return res.json(printRequests);
    } catch (err) {
        console.error('Error listing requests', err && (err.stack || err.message || err));
        return res.status(500).json({ error: 'Failed to list requests' });
    }
});

// PATCH /api/requests/:id - accept or decline
app.patch('/api/requests/:id', printerAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { action, admin_notes } = req.body || {}; // action: 'accept' | 'reject'
        if (!action || (action !== 'accept' && action !== 'reject')) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const status = action === 'accept' ? 'Accepted' : 'Rejected';
        const handler = req.printer.slack_id;
        const handledAt = new Date().toISOString();

        if (process.env.AIRTABLE_REQUESTS_TABLE_ID) {
            // Update Airtable record
            try {
                const fields = {
                    Status: status,
                    HandlerSlackID: handler,
                    HandlerName: req.printer.name || null,
                    HandledAt: handledAt,
                };
                if (admin_notes) fields.AdminNotes = admin_notes;

                const updated = await base(process.env.AIRTABLE_REQUESTS_TABLE_ID).update([
                    { id, fields }
                ]);
                return res.json({ id: updated[0].id, fields: updated[0].fields });
            } catch (err) {
                console.error('Failed to update Airtable request', err && (err.stack || err.message || err));
                return res.status(500).json({ error: 'Failed to update request' });
            }
        }

        // update in-memory
        const idx = printRequests.findIndex(r => r.id === id || r.airtable_id === id);
        if (idx === -1) return res.status(404).json({ error: 'Request not found' });
        printRequests[idx].status = status;
        printRequests[idx].handler = handler;
        printRequests[idx].handledAt = handledAt;
        if (admin_notes) printRequests[idx].admin_notes = admin_notes;
        return res.json(printRequests[idx]);
    } catch (err) {
        console.error('Error handling request update', err && (err.stack || err.message || err));
        return res.status(500).json({ error: 'Internal error' });
    }
});

// In-memory store for incoming print requests (simple and ephemeral)
const printRequests = [];

app.post('/api/requests', async (req, res) => {
    try {
        const { name, email, slack_id, description, file_link, material, desired_date, country, weight, notes } = req.body || {};

        // basic validation
        if (!name || !description || !(email || slack_id)) {
            return res.status(400).json({ error: 'Missing required fields: name, description, and either email or slack_id' });
        }

        const newRequest = {
            id: (printRequests.length + 1).toString(),
            name,
            email: email || null,
            slack_id: slack_id || null,
            description,
            file_link: file_link || null,
            material: material || null,
            desired_date: desired_date || null,
            country: country || null,
            weight: weight || null,
            notes: notes || null,
            received_at: new Date().toISOString(),
        };

        // store in-memory
        printRequests.push(newRequest);

        // log for operators
        // console.log('Received print request:', newRequest);

        // If AIRTABLE_REQUESTS_TABLE_ID is set, require Airtable persistence and return error on failure
        if (process.env.AIRTABLE_REQUESTS_TABLE_ID) {
            // ensure Airtable is fully configured
            if (!process.env.AIRTABLE_KEY || !process.env.AIRTABLE_BASE_ID) {
                console.error('Airtable requests table set but AIRTABLE_KEY or AIRTABLE_BASE_ID is missing');
                return res.status(500).json({ error: 'Airtable not configured for requests' });
            }

            try {
                // Build Airtable fields object (same shape as seed.js)
                const fields = {
                    Name: newRequest.name,
                    Email: newRequest.email,
                    SlackID: newRequest.slack_id,
                    Description: newRequest.description,
                    FileLink: newRequest.file_link,
                    Material: newRequest.material,
                    DesiredDate: newRequest.desired_date,
                    Country: newRequest.country,
                    // convert weight to number if present
                    WeightGrams: newRequest.weight ? Number(newRequest.weight) : null,
                    Notes: newRequest.notes,
                };

                const created = await base(process.env.AIRTABLE_REQUESTS_TABLE_ID).create([
                    { fields }
                ]);

                // Airtable returns an array of created records
                if (Array.isArray(created) && created[0] && created[0].id) {
                    newRequest.airtable_id = created[0].id;
                }

                // store in-memory and respond
                printRequests.push(newRequest);
                console.log('Saved print request to Airtable:', newRequest.airtable_id);
                return res.status(201).json(newRequest);
            } catch (err) {
                console.error('Failed to save print request to Airtable:', err && (err.stack || err.message || err));
                return res.status(500).json({ error: 'Failed to persist request to Airtable' });
            }
        }

        // No Airtable requests table configured: store in-memory and return success
        printRequests.push(newRequest);
        return res.status(201).json(newRequest);
    } catch (error) {
        console.error('Error handling print request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the frontend from the site/dist directory
app.use(express.static(path.resolve(__dirname, "../site/dist")));
app.get('/{*any}', (req, res, next) => {
    // Only serve index.html for non-API, non-static requests
    if (req.path.startsWith('/api/')) return next();
    // Prevent directory traversal attacks
    if (req.path.includes('..')) return res.status(400).send('Bad Request');
    res.sendFile(path.resolve(__dirname, "../site/dist", "index.html"));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
