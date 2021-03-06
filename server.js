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

app.get("/wipe/:key", (req, res) => {
    if (req.params.key == secret.key) {
        db.wipe();
        res.sendStatus(200);
    } else {
        res.sendStatus(403);
    }
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
        id: socket.id,
        pos: {
            x: config.world_options.worldWidth / 2,
            y: config.world_options.worldHeight / 2,
        },
        angle: 0,
        username: "Logging in...",
    });

    socket.on("disconnect", () => {
        for (let i = connected.length - 1; i >= 0; i--) {
            if (connected[i].id == socket.id) {
                connected.splice(i, 1);
            }
        }
    });

    socket.on("login", (data) => {
        console.log(
            chalk.yellow("[API Server]") +
                " received authentication request. " +
                chalk.magenta("User: " + data.username)
        );
        db.authenticateUser(data.username, data.password, (result, auth_token) => {
            if (result) {
                db.query(`SELECT * FROM ships WHERE username = '${data.username}'`, (err, results) => {
                    if (err) console.error(err);
                    console.log(results);
                    if (results) {
                        let raw = JSON.stringify(results[0]);
                        let parsed = JSON.parse(raw);
                        let x = parsed.x;
                        let y = parsed.y;
                        let angle = parsed.angle;
                        let fuel = parsed.fuel;

                        socket.emit("login_request", {
                            result: result,
                            auth_token: auth_token,
                            username: data.username,
                            x: x,
                            y: y,
                            angle: angle,
                            fuel: fuel,
                        });
                    }
                });
            }

            if (result) {
                connected.forEach((connection) => {
                    if (connection.id == socket.id) {
                        connection.username = data.username;
                    }
                });
            }
        });
    });

    socket.on("register", (data) => {
        console.log(
            chalk.yellow("[API Server]") + " received registration request. " + chalk.magenta("User: " + data.username)
        );
        db.registerUser(data.username.toLowerCase(), data.password, (result, msg) => {
            socket.emit("register_request", {
                result: result,
                msg: msg,
            });
        });
    });

    // socket.on("position", (data) => {
    //     db.auth(data.USERNAME, data.AUTHKEY, (auth) => {
    //         if (auth) {
    //             connected.forEach((connection) => {
    //                 if (connection.id == socket.id) {
    //                     //check if new position isn't too far from old position
    //                     let a = connection.pos.x - data.x;
    //                     let b = connection.pos.y - data.y;

    //                     let dist = Math.abs(Math.sqrt(a * a + b * b));
    //                     if (dist < 50) {
    //                         connection.pos = {
    //                             x: data.x,
    //                             y: data.y,
    //                         };
    //                         connection.angle = data.angle;
    //                     } else {
    //                         socket.emit("error", "Position has changed too much since last ping.");
    //                     }
    //                 }
    //             });
    //         }
    //     });
    // });

    socket.on("save", (data) => {
        db.auth(data.USERNAME, data.AUTHKEY, (auth) => {
            if (auth) {
                db.query(`SELECT * FROM ships WHERE username = '${data.USERNAME}'`, (err, results) => {
                    if (err) console.error(err);
                    // console.log("SAVE ATTEMPT: " + JSON.stringify(results));
                    if (results[0]) {
                        // console.log(results[0]);
                        let raw = JSON.stringify(results[0]);
                        let parsed = JSON.parse(raw);
                        // console.log("Found user: " + JSON.stringify(parsed));

                        let a = parsed.x - data.x;
                        let b = parsed.y - data.y;

                        let dist = Math.abs(Math.sqrt(a * a + b * b));
                        if (dist > 50) {
                            socket.emit("error", "Position has changed too much since last ping.");
                        }

                        db.query(
                            `UPDATE ships SET x = ${data.x}, y = ${data.y}, angle = ${data.angle}, fuel = ${data.fuel} WHERE username = '${data.USERNAME}'`,
                            (err, results) => {
                                if (err) console.error(err);
                            }
                        );
                    }
                });
            }
        });
    });

    socket.on("get_players", (data) => {
        db.auth(data.USERNAME, data.AUTHKEY, (auth) => {
            if (auth) {
                const players = [];
                connected.forEach((connection) => {
                    if (connection.id != socket.id) {
                        players.push({
                            x: connection.pos.x,
                            y: connection.pos.y,
                            angle: connection.angle,
                            username: connection.username,
                        });
                    }
                });

                // console.log("Players: " + JSON.stringify(players));

                socket.emit("players", players);
            }
        });
    });

    socket.on("refuel", (data) => {
        db.auth(data.USERNAME, data.AUTHKEY, (auth) => {
            if (auth) {
                db.query(`SELECT * FROM ships WHERE username = '${data.USERNAME}'`, (err, results) => {
                    if (results) {
                        let raw = JSON.stringify(results[0]);
                        let parsed = JSON.parse(raw);

                        let fuelNeeded = 100 - parsed.fuel;
                        let moneyNeeded = fuelNeeded * config.economy.fuelPrice;

                        if (parsed.balance >= moneyNeeded) {
                            //refuel fully
                            db.query(
                                `UPDATE ships SET fuel = 100, balance = ${
                                    parsed.balance - moneyNeeded
                                } WHERE username = '${data.USERNAME}'`,
                                (err, results) => {
                                    if (err) console.error(err);
                                }
                            );
                        } else {
                            //refuel partially
                            let fuelPossible = parsed.balance / config.economy.fuelPrice;
                            db.query(
                                `UPDATE ships SET fuel = ${parsed.fuel + fuelPossible}, balance = ${
                                    parsed.balance - fuelPossible * config.economy.fuelPrice
                                } WHERE username = '${data.USERNAME}'`,
                                (err, results) => {
                                    if (err) console.error(err);
                                }
                            );
                        }
                    }
                });
            }
        });
    });
});
