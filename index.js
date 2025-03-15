const express = require("express");
const app = express();

const path = require('path');
const fs = require("fs");
const javascriptObfuscator = require("javascript-obfuscator");

app.get("/*", (req, res, next) => {
    const fileName = req.params[0];
    const filePath = path.join(__dirname, "public", fileName);

    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.sendFile(path.join(__dirname, "public", "404.html"), (err) => {
                if (err) {
                    next(err); // Pass error to Express error handler
                }
            });
        } else {
            if (stats.isDirectory()) {
                const indexPath = path.join(filePath, "index.html");
                fs.readFile(indexPath, (err, data) => {
                    if (err) {
                        console.log(err);
                    } else {
                        res.setHeader("Content-Type", "text/html");
                        res.send(data);
                    }
                });
            } else {
                const ext = path.extname(filePath).slice(1);

                if (ext === "js") {
                    fs.readFile(filePath, "utf8", (err, data) => {
                        if (err) {
                            next(err);
                        } else {
                            const obfuscatedCode = javascriptObfuscator
                                .obfuscate(data)
                                .getObfuscatedCode();
                            res.setHeader(
                                "Content-Type",
                                "application/javascript",
                            );
                            res.send(data);
                        }
                    });
                } else {
                    res.sendFile(filePath, (err) => {
                        if (err) {
                            next(err);
                        }
                    });
                }
            }
        }
    });
});
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
