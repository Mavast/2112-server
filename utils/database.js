const mysql = require("mysql");
const secret = require("../secret.json");
const bcrypt = require("bcrypt");
const chalk = require("chalk");
const saltRounds = 10;

class Database {
    constructor() {
        this.connection = mysql.createConnection({
            host: "localhost",
            user: "game",
            password: secret.db_pass,
            database: "game_db",
        });
    }

    query(query, callback) {
        this.connection.query(query, callback);
    }

    //Should only be run once to reset the world, this generates random planets etc.
    generateWorld(options) {
        console.log(chalk.yellow("[Database]") + " attempting to generate planets...");
        //reset database
        this.query(`DROP TABLE planets`, (err, results, fields) => {
            if (err) throw err;
        });
        this.query(
            `CREATE TABLE planets (x INT, y INT, texture INT, size FLOAT, type VARCHAR(40))`,
            (err, results, fields) => {
                if (err) throw err;
            }
        );

        let planets = [];

        for (let i = 0; i < 500; i++) {
            const planet = {
                x: Math.floor(Math.random() * options.worldWidth),
                y: Math.floor(Math.random() * options.worldHeight),
                texture: Math.floor(Math.random() * 10),
                size: 1 + Math.random() * 5,
                type: options.types[Math.floor(Math.random() * options.types.length)],
            };

            this.query(
                `INSERT INTO planets (x, y, texture, size, type) VALUES (${planet.x}, ${planet.y}, ${planet.texture}, ${planet.size}, '${planet.type}')`,
                (err, results, fields) => {
                    if (err) throw err;
                }
            );
        }

        console.log(chalk.green("[Database]") + " generated planets");
    }

    //Has to be called whenever someone registers an account
    registerUser(username, password, callback) {
        //hash password
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) console.error(err);
            //insert new user
            this.query(
                `INSERT INTO users (username, password) VALUES ('${username}', '${hash}')`,
                (err, results, fields) => {
                    if (err) {
                        console.error(err);
                        callback(false, "Error, try a different username!");
                    } else {
                        console.log("Registered new user: " + username + " (ID: " + results.insertId + ")");
                        callback(true, "Successfully registered!");
                    }
                }
            );
            this.query(
                `INSERT INTO ships (x, y, angle, fuel, username) VALUES (125000, 125000, 0, 100, '${username}')`,
                (err, results, fields) => {
                    if (err) console.error(err);
                }
            );
        });
    }

    //Has to be called whenever someone logs in, after, the server can use the auth_token to check wether someone has
    // permission to execute an action on behalf of the client
    authenticateUser(username, password, callback) {
        //check if username exists
        const uname = username.toLowerCase();
        console.log(`Searching for user: ${username}`);
        this.query(`SELECT * FROM users WHERE username = '${uname}'`, (err, results, fields) => {
            if (err) console.error(err);
            if (results.length) {
                //check if password matches hash
                const raw = JSON.stringify(results[0]);
                const parsed = JSON.parse(raw);
                console.log(`Raw: ${raw}`);
                console.log(`Parsed: ${parsed}`);
                bcrypt.compare(password, parsed.password, (err, result) => {
                    if (err) console.error(err);
                    if (result) {
                        const auth_token = "_" + Math.random().toString(36).substr(2, 9);
                        //store authtoken in Database
                        console.log("Storing auth_token " + auth_token + " for user " + username);
                        this.query(
                            `UPDATE users SET auth_token = '${auth_token}' WHERE username = '${username}'`,
                            (err, results, fields) => {
                                if (err) {
                                    console.error(err);
                                    callback(false, "Server error!");
                                } else {
                                    callback(true, auth_token);
                                }
                            }
                        );
                    } else {
                        callback(false, "Password doesn't match.");
                    }
                });
            } else {
                //no username exists
                callback(false, "That username cannot be found.");
            }
        });
    }

    auth(username, authkey, callback) {
        const uname = username.toLowerCase();
        this.query(`SELECT auth_token FROM users WHERE username = '${uname}'`, (err, results, fields) => {
            if (err) console.error(err);
            let raw = JSON.stringify(results[0]);
            // console.log("AUTH REQUEST: " + raw);

            let parsed = JSON.parse(raw);
            // console.log(parsed);
            // console.log(parsed.auth_token + " == " + authkey);
            if (parsed.auth_token == authkey) {
                callback(true);
            } else {
                callback(false);
            }
        });
    }

    wipe() {
        this.query("DROP TABLE users", (err, results) => {
            if (err) console.error(err);
        });
        this.query("DROP TABLE ships", (err, results) => {
            if (err) console.error(err);
        });
        this.query(
            `CREATE TABLE users (username VARCHAR(50), password VARCHAR(255), auth_token VARCHAR(20))`,
            (err, results) => {
                if (err) console.error(err);
            }
        );
        this.query(
            `CREATE TABLE ships (x INT, y INT, angle FLOAT, fuel FLOAT, username VARCHAR(50))`,
            (err, results) => {
                if (err) console.error(err);
            }
        );
    }
}

module.exports = Database;
