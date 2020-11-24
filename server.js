const express = require("express");
const bodyParser = require("body-parser");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");
const Enmap = require("enmap");

//Load WS Events
const events = new Enmap();
const eventPath = path.join(__dirname, "events");

fs.readdir(eventPath, function (err, files) {
    //handling error
    if (err) {
        return console.log("Unable to scan directory: " + err);
    }
    //listing all files using forEach
    files.forEach(function (file) {
        if (!file.endsWith(".js")) return;
        let props = require(`./commands/${file}`);
        let eventName = file.split(".")[0];
        console.log(`Attempting to load WS event ${eventName}`);
        events.set(commandName, props);
    });
});

const WebSocket = require("ws");

const app = express();
app.use(bodyParser.json());

const API_PORT = process.env.API_PORT || 3000;
const WS_PORT = process.env.WS_PORT || 7777;

const ws = new WebSocket.Server({ port: WS_PORT });

const DB = require("./utils/database.js");
const db = new DB();

ws.on("connection", function connection(ws) {
    ws.on("message", function incoming(message) {
        //Parse message
        const parsed = JSON.parse(message);
        //loop through all events to find if it applies
        const event = events.get(parsed.event);
        if (!event) return;

        ws.send(event.run(parsed.data));
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
