const express = require("express");
const bodyParser = require("body-parser");
const chalk = require("chalk");
const config = require("./config.json");

const WebSocket = require("ws");

const app = express();
app.use(bodyParser.json());

const API_PORT = process.env.API_PORT || 3000;
const WS_PORT = process.env.WS_PORT || 7777;

const ws = new WebSocket.Server({ port: WS_PORT });

const DB = require("./utils/database.js");
const db = new DB();

const eventTemplates = [
    {
        type: "ping",
        run: (ws, db) => {
            ws.send("Pong!");
        },
    },
    {
        type: "get_queue",
        run: (ws, db) => {
            db.query(`SELECT * FROM chunks`, (err, results, fields) => {
                ws.send(
                    JSON.stringify({
                        type: "render_queue",
                        data: results,
                    })
                );
            });
        },
    },
];

const events = [];

eventTemplates.forEach((template) => {
    events.push(template);
});

db.generateWorld(config.world_options);

const isJsonString = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

ws.on("connection", function connection(ws) {
    ws.on("message", function incoming(message) {
        //Parse message
        if (isJsonString(message)) {
            const parsed = JSON.parse(message);
            //loop through all events to find if it applies
            events.forEach((event) => {
                if (event.type === parsed.event) {
                    event.run(ws, db);
                }
            });
        }
    });
});

app.get("/", (req, res) => {
    res.sendStatus(200);
});

app.post("/register", (req, res) => {
    console.log(
        chalk.yellow("[API Server]") + " received registration request. " + chalk.magenta("User: " + req.body.username)
    );
    db.registerUser(req.body.username.toLowerCase(), req.body.password, (result, msg) => {
        res.send({
            result: result,
            msg: msg,
        });
    });
});

app.post("/authenticate", (req, res) => {
    console.log(
        chalk.yellow("[API Server]") +
            " received authentication request. " +
            chalk.magenta("User: " + req.body.username)
    );
    db.authenticateUser(req.body.username, req.body.password, (result, auth_token) => {
        res.send({
            result: result,
            auth_token: auth_token,
        });
    });
});

app.listen(API_PORT, () => {
    console.log(chalk.green("[API Server]") + " online on port: " + chalk.blue(API_PORT));
    console.log(chalk.green("[WebSocket Server]") + " online on port: " + chalk.blue(WS_PORT));
});
