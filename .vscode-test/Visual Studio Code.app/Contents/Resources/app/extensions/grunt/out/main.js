/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const vscode = require("vscode");
const nls = require("vscode-nls");
const localize = nls.config(process.env.VSCODE_NLS_CONFIG)(__filename);
let taskProvider;
function activate(_context) {
    let workspaceRoot = vscode.workspace.rootPath;
    if (!workspaceRoot) {
        return;
    }
    let pattern = path.join(workspaceRoot, 'Gruntfile.js');
    let detectorPromise = undefined;
    let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    fileWatcher.onDidChange(() => detectorPromise = undefined);
    fileWatcher.onDidCreate(() => detectorPromise = undefined);
    fileWatcher.onDidDelete(() => detectorPromise = undefined);
    function onConfigurationChanged() {
        let autoDetect = vscode.workspace.getConfiguration('grunt').get('autoDetect');
        if (taskProvider && autoDetect === 'off') {
            detectorPromise = undefined;
            taskProvider.dispose();
            taskProvider = undefined;
        }
        else if (!taskProvider && autoDetect === 'on') {
            taskProvider = vscode.workspace.registerTaskProvider('grunt', {
                provideTasks: () => {
                    if (!detectorPromise) {
                        detectorPromise = getGruntTasks();
                    }
                    return detectorPromise;
                },
                resolveTask(_task) {
                    return undefined;
                }
            });
        }
    }
    vscode.workspace.onDidChangeConfiguration(onConfigurationChanged);
    onConfigurationChanged();
}
exports.activate = activate;
function deactivate() {
    if (taskProvider) {
        taskProvider.dispose();
    }
}
exports.deactivate = deactivate;
function exists(file) {
    return new Promise((resolve, _reject) => {
        fs.exists(file, (value) => {
            resolve(value);
        });
    });
}
function exec(command, options) {
    return new Promise((resolve, reject) => {
        cp.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}
let _channel;
function getOutputChannel() {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('Grunt Auto Detection');
    }
    return _channel;
}
const buildNames = ['build', 'compile', 'watch'];
function isBuildTask(name) {
    for (let buildName of buildNames) {
        if (name.indexOf(buildName) !== -1) {
            return true;
        }
    }
    return false;
}
const testNames = ['test'];
function isTestTask(name) {
    for (let testName of testNames) {
        if (name.indexOf(testName) !== -1) {
            return true;
        }
    }
    return false;
}
function getGruntTasks() {
    return __awaiter(this, void 0, void 0, function* () {
        let workspaceRoot = vscode.workspace.rootPath;
        let emptyTasks = [];
        if (!workspaceRoot) {
            return emptyTasks;
        }
        let gruntfile = path.join(workspaceRoot, 'Gruntfile.js');
        if (!(yield exists(gruntfile))) {
            return emptyTasks;
        }
        let command;
        let platform = process.platform;
        if (platform === 'win32' && (yield exists(path.join(workspaceRoot, 'node_modules', '.bin', 'grunt.cmd')))) {
            command = path.join('.', 'node_modules', '.bin', 'grunt.cmd');
        }
        else if ((platform === 'linux' || platform === 'darwin') && (yield exists(path.join(workspaceRoot, 'node_modules', '.bin', 'grunt')))) {
            command = path.join('.', 'node_modules', '.bin', 'grunt');
        }
        else {
            command = 'grunt';
        }
        let commandLine = `${command} --help --no-color`;
        try {
            let { stdout, stderr } = yield exec(commandLine, { cwd: workspaceRoot });
            if (stderr) {
                getOutputChannel().appendLine(stderr);
                getOutputChannel().show(true);
            }
            let result = [];
            if (stdout) {
                // grunt lists tasks as follows (description is wrapped into a new line if too long):
                // ...
                // Available tasks
                //         uglify  Minify files with UglifyJS. *
                //         jshint  Validate files with JSHint. *
                //           test  Alias for "jshint", "qunit" tasks.
                //        default  Alias for "jshint", "qunit", "concat", "uglify" tasks.
                //           long  Alias for "eslint", "qunit", "browserify", "sass",
                //                 "autoprefixer", "uglify", tasks.
                //
                // Tasks run in the order specified
                let lines = stdout.split(/\r{0,1}\n/);
                let tasksStart = false;
                let tasksEnd = false;
                for (let line of lines) {
                    if (line.length === 0) {
                        continue;
                    }
                    if (!tasksStart && !tasksEnd) {
                        if (line.indexOf('Available tasks') === 0) {
                            tasksStart = true;
                        }
                    }
                    else if (tasksStart && !tasksEnd) {
                        if (line.indexOf('Tasks run in the order specified') === 0) {
                            tasksEnd = true;
                        }
                        else {
                            let regExp = /^\s*(\S.*\S)  \S/g;
                            let matches = regExp.exec(line);
                            if (matches && matches.length === 2) {
                                let name = matches[1];
                                let kind = {
                                    type: 'grunt',
                                    task: name
                                };
                                let source = 'grunt';
                                let task = name.indexOf(' ') === -1
                                    ? new vscode.Task(kind, name, source, new vscode.ShellExecution(`${command} ${name}`))
                                    : new vscode.Task(kind, name, source, new vscode.ShellExecution(`${command} "${name}"`));
                                result.push(task);
                                let lowerCaseTaskName = name.toLowerCase();
                                if (isBuildTask(lowerCaseTaskName)) {
                                    task.group = vscode.TaskGroup.Build;
                                }
                                else if (isTestTask(lowerCaseTaskName)) {
                                    task.group = vscode.TaskGroup.Test;
                                }
                            }
                        }
                    }
                }
            }
            return result;
        }
        catch (err) {
            let channel = getOutputChannel();
            if (err.stderr) {
                channel.appendLine(err.stderr);
            }
            if (err.stdout) {
                channel.appendLine(err.stdout);
            }
            channel.appendLine(localize(0, null, err.error ? err.error.toString() : 'unknown'));
            channel.show(true);
            return emptyTasks;
        }
    });
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/grunt/out/main.js.map
