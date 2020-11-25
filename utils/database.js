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
        console.log(chalk.yellow("[Database]") + " attempting to generate chunks...");
        //reset database
        this.query(`DROP TABLE chunks`, (err, results, fields) => {
            if (err) throw err;
        });
        this.query(
            `CREATE TABLE chunks (x INT, y INT, width INT, height INT, planet BOOLEAN, planet_x INT, planet_y INT)`,
            (err, results, fields) => {
                if (err) throw err;
            }
        );

        for (let x = 0; x < options.horizontal_chunks; x++) {
            for (let y = 0; y < options.vertical_chunks; y++) {
                let planet = false;
                if (Math.random() > 0.65) {
                    planet = true;
                }

                let chunk = {
                    x: x,
                    y: y,
                    width: options.chunkWidth,
                    height: options.chunkHeight,
                    planet: planet,
                    planet_x: Math.floor(Math.random() * options.chunkWidth),
                    planet_y: Math.floor(Math.random() * options.chunkHeight),
                };

                this.query(
                    `INSERT INTO chunks (x, y, width, height, planet, planet_x, planet_y) VALUES (${chunk.x}, ${chunk.y}, ${chunk.width}, ${chunk.height}, ${chunk.planet}, ${chunk.planet_x}, ${chunk.planet_y})`,
                    (err, results, fields) => {
                        if (err) throw err;
                    }
                );
            }
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
                        callback(true, "Succesfully registered!");
                    }
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
}

module.exports = Database;
