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
        run: (ws) => {
            ws.send("Pong!");
        },
    },
    {
        type: "get_queue",
        run: (ws, data) => {
            db.query(`SELECT * FROM chunks`, (err, results, fields) => {
                // console.log(`get_queue chunks: ${results}`);
                const toRender = [];
                //check if the chunk is close enough to the player to be rendered
                const chunkPos = {
                    chunk_x: (data.x - (data.x % config.world_options.chunkWidth)) / config.world_options.chunkWidth,
                    chunk_y: (data.y - (data.y % config.world_options.chunkHeight)) / config.world_options.chunkHeight,
                };

                results.forEach((chunk) => {
                    if (chunk.x == chunkPos.chunk_x && chunk.y == chunkPos.chunk_y) {
                        toRender.push(chunk);
                    }
                });

                ws.send(
                    JSON.stringify({
                        type: "render_queue",
                        data: toRender,
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

// db.generateWorld(config.world_options);

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
            console.log("Attempting to run event: " + parsed.type);
            //loop through all events to find if it applies
            events.forEach((event) => {
                if (event.type === parsed.type) {
                    event.run(ws, parsed.data);
                }
            });
        }
    });
});

app.get("/", (req, res) => {
    res.sendStatus(200);
});

app.get("/planets", (req, res) => {
    console.log(chalk.yellow("[API Server]") + " received planets request. ");
    db.query(`SELECT * FROM planets`, (err, results, fields) => {
        if (err) console.error(err);
        res.send({
            planets: planets,
        });
    });
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
