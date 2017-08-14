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
    let pattern = path.join(workspaceRoot, 'gulpfile{.babel.js,.js}');
    let gulpPromise = undefined;
    let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    fileWatcher.onDidChange(() => gulpPromise = undefined);
    fileWatcher.onDidCreate(() => gulpPromise = undefined);
    fileWatcher.onDidDelete(() => gulpPromise = undefined);
    function onConfigurationChanged() {
        let autoDetect = vscode.workspace.getConfiguration('gulp').get('autoDetect');
        if (taskProvider && autoDetect === 'off') {
            gulpPromise = undefined;
            taskProvider.dispose();
            taskProvider = undefined;
        }
        else if (!taskProvider && autoDetect === 'on') {
            taskProvider = vscode.workspace.registerTaskProvider('gulp', {
                provideTasks: () => {
                    if (!gulpPromise) {
                        gulpPromise = getGulpTasks();
                    }
                    return gulpPromise;
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
        _channel = vscode.window.createOutputChannel('Gulp Auto Detection');
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
function getGulpTasks() {
    return __awaiter(this, void 0, void 0, function* () {
        let workspaceRoot = vscode.workspace.rootPath;
        let emptyTasks = [];
        if (!workspaceRoot) {
            return emptyTasks;
        }
        let gulpfile = path.join(workspaceRoot, 'gulpfile.js');
        if (!(yield exists(gulpfile))) {
            gulpfile = path.join(workspaceRoot, 'gulpfile.babel.js');
            if (!(yield exists(gulpfile))) {
                return emptyTasks;
            }
        }
        let gulpCommand;
        let platform = process.platform;
        if (platform === 'win32' && (yield exists(path.join(workspaceRoot, 'node_modules', '.bin', 'gulp.cmd')))) {
            gulpCommand = path.join('.', 'node_modules', '.bin', 'gulp.cmd');
        }
        else if ((platform === 'linux' || platform === 'darwin') && (yield exists(path.join(workspaceRoot, 'node_modules', '.bin', 'gulp')))) {
            gulpCommand = path.join('.', 'node_modules', '.bin', 'gulp');
        }
        else {
            gulpCommand = 'gulp';
        }
        let commandLine = `${gulpCommand} --tasks-simple --no-color`;
        try {
            let { stdout, stderr } = yield exec(commandLine, { cwd: workspaceRoot });
            if (stderr && stderr.length > 0) {
                getOutputChannel().appendLine(stderr);
                getOutputChannel().show(true);
            }
            let result = [];
            if (stdout) {
                let lines = stdout.split(/\r{0,1}\n/);
                for (let line of lines) {
                    if (line.length === 0) {
                        continue;
                    }
                    let kind = {
                        type: 'gulp',
                        task: line
                    };
                    let task = new vscode.Task(kind, line, 'gulp', new vscode.ShellExecution(`${gulpCommand} ${line}`));
                    result.push(task);
                    let lowerCaseLine = line.toLowerCase();
                    if (isBuildTask(lowerCaseLine)) {
                        task.group = vscode.TaskGroup.Build;
                    }
                    else if (isTestTask(lowerCaseLine)) {
                        task.group = vscode.TaskGroup.Test;
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
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/gulp/out/main.js.map
