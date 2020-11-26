const express = require("express");
const bodyParser = require("body-parser");
const chalk = require("chalk");
const config = require("./config.json");
const secret = require("./secret.json");

const app = express();
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

io.on("connection", (socket) => {
    connected.push({
        socket: socket,
        pos: {
            x: 0,
            y: 0,
        },
    });
    socket.on("disconnect", () => {
        connected.splice(connected.indexOf(socket), 1);
    });

    socket.on("position", (pos) => {
        if (connected.indexOf(socket)) {
            connected[connected.indexOf(socket)].pos = pos;
        }
    });
});
