const express = require("express");
const bodyParser = require("body-parser");
const chalk = require("chalk");
const config = require("./config.json");
const secret = require("./secret.json");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var cors = require("cors");
app.use(cors());

const API_PORT = process.env.API_PORT || 3000;

const DB = require("./utils/database.js");
const db = new DB();

const isJsonString = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

app.get("/", (req, res) => {
    res.sendStatus(200);
});

app.get("/planets", (req, res) => {
    console.log(chalk.yellow("[API Server]") + " received planets request. ");
    db.query(`SELECT * FROM planets`, (err, results, fields) => {
        if (err) console.error(err);
        res.send({
            planets: results,
        });
    });
});

app.get("/generate/:key", (req, res) => {
    if (req.params.key == secret.key) {
        db.generateWorld(config.world_options);
        res.sendStatus(200);
    } else {
        res.sendStatus(403);
    }
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

const server = app.listen(API_PORT, () => {
    console.log(chalk.green("[API Server]") + " online on port: " + chalk.blue(API_PORT));
});

var io = require("socket.io")(server, {
    cors: {
        origin: "http://mavast.xyz",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

const connected = [];
const players = [];

io.on("connection", (socket) => {
    connected.push({
        socket: socket,
        pos: {
            x: 0,
            y: 0,
        },
        angle: 0,
    });

    socket.on("disconnect", () => {
        for (let i = connected.length - 1; i >= 0; i--) {
            if (connected[i].socket == socket) {
                connected.splice(i, 1);
            }
        }
    });

    socket.on("position", (data) => {
        if (db.auth(data.USERNAME, data.AUTHKEY)) {
            connected.forEach((connection) => {
                if (connection.socket == socket) {
                    connection.pos = {
                        x: data.x,
                        y: data.y,
                    };
                    connection.angle = data.angle;
                }
            });
        }
    });

    socket.on("get_players", () => {
        if (db.auth(data.USERNAME, data.AUTHKEY)) {
            const players = [];
            connected.forEach((connection) => {
                if (connection.socket != socket) {
                    players.push({
                        x: connection.pos.x,
                        y: connection.pos.y,
                        angle: connection.angle,
                    });
                }
            });

            socket.emit("players", players);
        }
    });
});
