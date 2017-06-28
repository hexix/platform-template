'use strict';
const PlatformLib = require("./lib/platform.js").PlatformLib;
const fs = require("fs");
const path = require("path");
const parseCommand = require("command-line-commands");
const copyTemplates = require("copy-template-dir");
// const usage = require("command-line-usage");
const Promise = require("bluebird");
const chalk = require("chalk");
const childProcess = require("child_process");
const exec = childProcess.exec;
const spawnSync = childProcess.spawnSync;
const spawn = require("cross-spawn");
//const spawn = childProcess.spawn;

var platLib = new PlatformLib();
var retCodes = platLib.RetCodes;
var builtIn = platLib.BuiltIn;

function PlatformAdmin() {
    Promise.resolve()
        .then( () => { return platLib.BuildOpts(); })
        .then( (opts) => { return platLib.BuildConfig(opts); })
        .then( (config) => { return platLib.LoadConfig(config); })
        .then( (config) => { return platLib.LookupAction(config); })
        .then( (config) => { return platLib.PerformActions(config); })
        .catch( displayError );
}



function performBuiltIn() {
    return new Promise((resolve, reject) => {
        var actionKey = options[0];
        switch (actionKey) {
            case "init":
                if (options.commandLineArr.length != 2) reject(retCodes.ERRARGS);
                createDir(options.commandLineArr[1])
                    .then(copyPlatformFiles)
                    .then(resolve(actionKey))
                    .catch((err) => { reject(err); });
                break;
            case "env":
                performAction(builtInActions.env)
                    .then(resolve(actionKey))
                    .catch((err) => { reject(err); });
                break;
        }
    });
}

function copyPlatformFiles(dirName) {
    return new Promise((resolve, reject) => {
        copyTemplates("templates/platform-template",
            dirName,
            null,
            (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    if (verbose) {
                        files.forEach(file => console.log("Copied file: " + file));
                    }
                    resolve(retCodes.DONE);
                }
            });
        // platformTemplate.dirs.forEach((dirName => {
        //     createDir(dirName);
        // }));
        // platformTemplate.files.forEach((fileName) => {

        // });
    });
}

function performAction(action) {
    return new Promise((resolve, reject) => {
        var commandString = action.command;
        var spawnOpts;
        if (action.launchType == "back") {
            commandString = "start \"Hexix\" " + action.command;
            spawnOpts = {
                detached: true,
                stdio: "ignore",
                shell: true
            }
            var child = spawn(commandString, [], spawnOpts)
                .on("error", (err) => {
                    reject(err);
                })
                .on("exit", (ret) => {
                    if (ret != 0) {
                        reject("Exit code: " + ret);
                    } else {
                        resolve();
                    }
                });
        } else {
            spawnOpts = {
                detached: false,
                stdio: [
                    "ignore",
                    "inherit",
                    "pipe"
                ],
                shell: true
            }
            var child = spawn(commandString, [], spawnOpts)
                .on("error", (err) => {
                    reject(err);
                })
                .on("exit", (ret) => {
                    if (ret != 0) {
                        reject("Exit code: " + ret);
                    } else {
                        resolve();
                    }
                })
                .stderr.on("data", (err) => {
                    reject(err);
                });
        }
    });
}

function displayError(err) {
    if (err != retCodes.DONE) {
        console.log(chalk.red("Hexix Platform Error: %s"), err);
        if (err == retCodes.ERRARGS) {
            Promise.resolve()
                .then(showUsage)
                .catch(err => {console.log(err)});
        }
    }
}

function showUsage(config = null) {
    return Promise.resolve(config)
    .then( () => {
        var opts = { verbose: false, service: "builtIn", commandLineArr: [] };
        return platLib.BuildConfig(opts); 
        })
    .then( config => { return platLib.LoadConfig(config); })
    .catch( err => {
            if (err) {
                var skelConfig = {};
                skelConfig.options = opts;
                skelConfig.services = [];
                skelConfig.services.push(platLib.BuiltIn);
            }
            return skelConfig;
    })
    .then( config => {
        console.log(chalk.bold("Usage: "));
        console.log("  platform-admin [OPTIONS] _action_");
        console.log("\nOptions:");
        console.log("  -v, -verbose\n");
        console.log("  -s, -service _service_\n");

        if (config) {
            if (config.services) {
                if (config.services.length > 1) {
                    config.services.forEach(service => {
                        console.log("\n");
                        showDetail(service.title, "Usage:  -s " + service.id, 30, 0);
                        Object.keys(service.actions).forEach(actionKey => {
                            var action = service.actions[actionKey];
                            showDetail(actionKey, action.usage);
                        });
                    });
                }
            }
        }
        return;
    })
    .catch(err => { 
        console.error(chalk.red("Error: can't display usage information"));
        return;
    });
    
}

function showDetail(id, usage, minSpacing = 25, indentSpacing = 2) {
    var optionString = id;
    if (usage) {
        var spacesToAdd = Math.max((minSpacing - id.length), 0);
        for (var i=0; i<spacesToAdd; i++) { optionString += " "; }
        optionString += "-  ";
        optionString += usage;
    }
    var indent = "";
    for (var i=0; i<indentSpacing; i++) { indent += " "; }
    console.log(indent + optionString);
}

module.exports = PlatformAdmin;
module.exports.ShowUsage = showUsage;