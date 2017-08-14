/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var child_process_1 = require("child_process");
var path_1 = require("path");
var fs = require("fs");
var utilities_1 = require("./utilities");
var protocolDetection_1 = require("./protocolDetection");
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.toggleSkippingFile', toggleSkippingFile));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.pickLoadedScript', function () { return pickLoadedScript(); }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.provideInitialConfigurations', function () { return createInitialConfigurations(); }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.node-debug.startSession', function (config) { return startSession(config); }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.pickNodeProcess', function () { return pickProcess(); }));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//---- toggle skipped files
function toggleSkippingFile(res) {
    var resource = res;
    if (!resource) {
        var activeEditor = vscode.window.activeTextEditor;
        resource = activeEditor && activeEditor.document.fileName;
    }
    if (resource) {
        var args = typeof resource === 'string' ? { resource: resource } : { sourceReference: resource };
        vscode.commands.executeCommand('workbench.customDebugRequest', 'toggleSkipFileStatus', args);
    }
}
function pickLoadedScript() {
    return listLoadedScripts().then(function (items) {
        var options = {
            placeHolder: utilities_1.localize('select.script', "Select a script"),
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true
        };
        if (items === undefined) {
            items = [{ label: utilities_1.localize('no.loaded.scripts', "No loaded scripts available"), description: '' }];
        }
        vscode.window.showQuickPick(items, options).then(function (item) {
            if (item && item.source) {
                var uri = vscode.Uri.parse("debug:" + item.source.path);
                vscode.workspace.openTextDocument(uri).then(function (doc) { return vscode.window.showTextDocument(doc); });
            }
        });
    });
}
function listLoadedScripts() {
    return vscode.commands.executeCommand('workbench.customDebugRequest', 'getLoadedScripts', {}).then(function (reply) {
        if (reply && reply.success) {
            return reply.body.loadedScripts;
        }
        else {
            return undefined;
        }
    });
}
function pickProcess() {
    return listProcesses().then(function (items) {
        var options = {
            placeHolder: utilities_1.localize('pickNodeProcess', "Pick the node.js or gulp process to attach to"),
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true
        };
        return vscode.window.showQuickPick(items, options).then(function (item) {
            return item ? item.pid : null;
        });
    });
}
function listProcesses() {
    return new Promise(function (resolve, reject) {
        var NODE = new RegExp('^(?:node|iojs|gulp)$', 'i');
        if (process.platform === 'win32') {
            var CMD_PID_1 = new RegExp('^(.+) ([0-9]+)$');
            var EXECUTABLE_ARGS_1 = new RegExp('^(?:"([^"]+)"|([^ ]+))(?: (.+))?$');
            var stdout_1 = '';
            var stderr_1 = '';
            var cmd = child_process_1.spawn('cmd');
            cmd.stdout.on('data', function (data) {
                stdout_1 += data.toString();
            });
            cmd.stderr.on('data', function (data) {
                stderr_1 += data.toString();
            });
            cmd.on('exit', function () {
                if (stderr_1.length > 0) {
                    reject(stderr_1);
                }
                else {
                    var items = [];
                    var lines = stdout_1.split('\r\n');
                    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                        var line = lines_1[_i];
                        var matches = CMD_PID_1.exec(line.trim());
                        if (matches && matches.length === 3) {
                            var cmd_1 = matches[1].trim();
                            var pid = matches[2];
                            // remove leading device specifier
                            if (cmd_1.indexOf('\\??\\') === 0) {
                                cmd_1 = cmd_1.replace('\\??\\', '');
                            }
                            var executable_path = void 0;
                            var args = void 0;
                            var matches2 = EXECUTABLE_ARGS_1.exec(cmd_1);
                            if (matches2 && matches2.length >= 2) {
                                if (matches2.length >= 3) {
                                    executable_path = matches2[1] || matches2[2];
                                }
                                else {
                                    executable_path = matches2[1];
                                }
                                if (matches2.length === 4) {
                                    args = matches2[3];
                                }
                            }
                            if (executable_path) {
                                var executable_name = path_1.basename(executable_path);
                                executable_name = executable_name.split('.')[0];
                                if (!NODE.test(executable_name)) {
                                    continue;
                                }
                                items.push({
                                    label: executable_name,
                                    description: pid,
                                    detail: cmd_1,
                                    pid: pid
                                });
                            }
                        }
                    }
                    resolve(items);
                }
            });
            cmd.stdin.write('wmic process get ProcessId,CommandLine \n');
            cmd.stdin.end();
        }
        else {
            var PID_CMD_1 = new RegExp('^\\s*([0-9]+)\\s+(.+)$');
            var MAC_APPS_1 = new RegExp('^.*/(.*).(?:app|bundle)/Contents/.*$');
            child_process_1.exec('ps -ax -o pid=,command=', { maxBuffer: 1000 * 1024 }, function (err, stdout, stderr) {
                if (err || stderr) {
                    reject(err || stderr.toString());
                }
                else {
                    var items = [];
                    var lines = stdout.toString().split('\n');
                    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                        var line = lines_2[_i];
                        var matches = PID_CMD_1.exec(line);
                        if (matches && matches.length === 3) {
                            var pid = matches[1];
                            var cmd = matches[2];
                            var parts = cmd.split(' '); // this will break paths with spaces
                            var executable_path = parts[0];
                            var executable_name = path_1.basename(executable_path);
                            if (!NODE.test(executable_name)) {
                                continue;
                            }
                            var application = cmd;
                            // try to show the correct name for OS X applications and bundles
                            var matches2 = MAC_APPS_1.exec(cmd);
                            if (matches2 && matches2.length === 2) {
                                application = matches2[1];
                            }
                            else {
                                application = executable_name;
                            }
                            items.unshift({
                                label: application,
                                description: pid,
                                detail: cmd,
                                pid: pid
                            });
                        }
                    }
                    resolve(items);
                }
            });
        }
    });
}
//---- extension.node-debug.provideInitialConfigurations
function loadPackage(folderPath) {
    try {
        var packageJsonPath = path_1.join(folderPath, 'package.json');
        var jsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        return JSON.parse(jsonContent);
    }
    catch (error) {
        // silently ignore
    }
    return undefined;
}
/**
 * returns an initial configuration json as a string
 */
function createInitialConfigurations() {
    var pkg = vscode.workspace.rootPath ? loadPackage(vscode.workspace.rootPath) : undefined;
    var config = {
        type: 'node',
        request: 'launch',
        name: utilities_1.localize('node.launch.config.name', "Launch Program")
    };
    var initialConfigurations = [config];
    if (pkg && pkg.name === 'mern-starter') {
        utilities_1.log(utilities_1.localize({ key: 'mern.starter.explanation', comment: ['argument contains product name without translation'] }, "Launch configuration for '{0}' project created.", 'Mern Starter'));
        configureMern(config);
    }
    else {
        var program = undefined;
        // try to find a better value for 'program' by analysing package.json
        if (pkg) {
            program = guessProgramFromPackage(pkg);
            if (program) {
                utilities_1.log(utilities_1.localize('program.guessed.from.package.json.explanation', "Launch configuration created based on 'package.json'."));
            }
        }
        if (!program) {
            utilities_1.log(utilities_1.localize('program.fall.back.explanation', "Launch configuration created will debug file in the active editor."));
            program = '${file}';
        }
        config['program'] = program;
        // prepare for source maps by adding 'outFiles' if typescript or coffeescript is detected
        if (vscode.workspace.textDocuments.some(function (document) { return document.languageId === 'typescript' || document.languageId === 'coffeescript'; })) {
            utilities_1.log(utilities_1.localize('outFiles.explanation', "Adjust glob pattern(s) in the 'outFiles' attribute so that they cover the generated JavaScript."));
            config['outFiles'] = ['${workspaceRoot}/out/**/*.js'];
        }
    }
    // Massage the configuration string, add an aditional tab and comment out processId.
    // Add an aditional empty line between attributes which the user should not edit.
    var configurationsMassaged = JSON.stringify(initialConfigurations, null, '\t').split('\n').map(function (line) { return '\t' + line; }).join('\n').trim();
    var comment1 = utilities_1.localize('launch.config.comment1', "Use IntelliSense to learn about possible Node.js debug attributes.");
    var comment2 = utilities_1.localize('launch.config.comment2', "Hover to view descriptions of existing attributes.");
    var comment3 = utilities_1.localize('launch.config.comment3', "For more information, visit: {0}", 'https://go.microsoft.com/fwlink/?linkid=830387');
    return [
        '{',
        "\t// " + comment1,
        "\t// " + comment2,
        "\t// " + comment3,
        '\t"version": "0.2.0",',
        '\t"configurations": ' + configurationsMassaged,
        '}'
    ].join('\n');
}
function configureMern(config) {
    config.protocol = 'inspector';
    config.runtimeExecutable = 'nodemon';
    config.runtimeArgs = ['--inspect=9222'];
    config.program = '${workspaceRoot}/index.js';
    config.port = 9222;
    config.restart = true;
    config.env = {
        BABEL_DISABLE_CACHE: '1',
        NODE_ENV: 'development'
    };
    config.console = 'integratedTerminal';
    config.internalConsoleOptions = 'neverOpen';
}
/*
 * try to find the entry point ('main') from the package.json
 */
function guessProgramFromPackage(jsonObject) {
    var program;
    try {
        if (jsonObject.main) {
            program = jsonObject.main;
        }
        else if (jsonObject.scripts && typeof jsonObject.scripts.start === 'string') {
            // assume a start script of the form 'node server.js'
            program = jsonObject.scripts.start.split(' ').pop();
        }
        if (program) {
            var path = void 0;
            if (path_1.isAbsolute(program)) {
                path = program;
            }
            else {
                path = path_1.join(vscode.workspace.rootPath, program);
                program = path_1.join('${workspaceRoot}', program);
            }
            if (!fs.existsSync(path) && !fs.existsSync(path + '.js')) {
                return undefined;
            }
        }
    }
    catch (error) {
        // silently ignore
    }
    return program;
}
//---- extension.node-debug.startSession
/**
 * The result type of the startSession command.
 */
var StartSessionResult = (function () {
    function StartSessionResult() {
    }
    return StartSessionResult;
}());
function startSession(config) {
    if (Object.keys(config).length === 0) {
        config = getFreshLaunchConfig();
    }
    // make sure that 'launch' configs have a 'cwd' attribute set
    if (config.request === 'launch' && !config.cwd) {
        if (vscode.workspace.rootPath) {
            config.cwd = vscode.workspace.rootPath;
        }
        else if (config.program) {
            // derive 'cwd' from 'program'
            config.cwd = path_1.dirname(config.program);
        }
    }
    // determine which protocol to use
    return determineDebugType(config).then(function (debugType) {
        if (debugType) {
            config.type = debugType;
            vscode.commands.executeCommand('vscode.startDebug', config);
        }
        return {
            status: 'ok'
        };
    });
}
function getFreshLaunchConfig() {
    var config = {
        type: 'node',
        name: 'Launch',
        request: 'launch'
    };
    if (vscode.workspace.rootPath) {
        // folder case: try to find more launch info in package.json
        var pkg = loadPackage(vscode.workspace.rootPath);
        if (pkg) {
            if (pkg.name === 'mern-starter') {
                configureMern(config);
            }
            else {
                config.program = guessProgramFromPackage(pkg);
            }
        }
    }
    if (!config.program) {
        // 'no folder' case (or no program found)
        var editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'javascript') {
            config.program = editor.document.fileName;
        }
        else {
            return {
                status: 'initialConfiguration' // let VS Code create an initial configuration
            };
        }
    }
    return config;
}
function determineDebugType(config) {
    if (config.request === 'attach' && typeof config.processId === 'string') {
        return determineDebugTypeForPidConfig(config);
    }
    else if (config.protocol === 'legacy') {
        return Promise.resolve('node');
    }
    else if (config.protocol === 'inspector') {
        return Promise.resolve('node2');
    }
    else {
        // 'auto', or unspecified
        return protocolDetection_1.detectDebugType(config);
    }
}
function determineDebugTypeForPidConfig(config) {
    var getPidP = isPickProcessCommand(config.processId) ?
        pickProcess() :
        Promise.resolve(config.processId);
    return getPidP.then(function (pid) {
        if (pid && pid.match(/^[0-9]+$/)) {
            var pidNum = Number(pid);
            putPidInDebugMode(pidNum);
            return determineDebugTypeForPidInDebugMode(config, pidNum);
        }
        else {
            throw new Error(utilities_1.localize('VSND2006', "Attach to process: '{0}' doesn't look like a process id.", pid));
        }
    }).then(function (debugType) {
        if (debugType) {
            // processID is handled, so turn this config into a normal port attach config
            config.processId = undefined;
            config.port = debugType === 'node2' ? protocolDetection_1.INSPECTOR_PORT_DEFAULT : protocolDetection_1.LEGACY_PORT_DEFAULT;
        }
        return debugType;
    });
}
function isPickProcessCommand(configProcessId) {
    configProcessId = configProcessId.trim();
    return configProcessId === '${command:PickProcess}' || configProcessId === '${command:extension.pickNodeProcess}';
}
function putPidInDebugMode(pid) {
    try {
        if (process.platform === 'win32') {
            // regular node has an undocumented API function for forcing another node process into debug mode.
            // 		(<any>process)._debugProcess(pid);
            // But since we are running on Electron's node, process._debugProcess doesn't work (for unknown reasons).
            // So we use a regular node instead:
            var command = "node -e process._debugProcess(" + pid + ")";
            child_process_1.execSync(command);
        }
        else {
            process.kill(pid, 'SIGUSR1');
        }
    }
    catch (e) {
        throw new Error(utilities_1.localize('VSND2021', "Attach to process: cannot enable debug mode for process '{0}' ({1}).", pid, e));
    }
}
function determineDebugTypeForPidInDebugMode(config, pid) {
    var debugProtocolP;
    if (config.port === protocolDetection_1.INSPECTOR_PORT_DEFAULT) {
        debugProtocolP = Promise.resolve('inspector');
    }
    else if (config.port === protocolDetection_1.LEGACY_PORT_DEFAULT) {
        debugProtocolP = Promise.resolve('legacy');
    }
    else if (config.protocol) {
        debugProtocolP = Promise.resolve(config.protocol);
    }
    else {
        debugProtocolP = protocolDetection_1.detectProtocolForPid(pid);
    }
    return debugProtocolP.then(function (debugProtocol) {
        return debugProtocol === 'inspector' ? 'node2' :
            debugProtocol === 'legacy' ? 'node' :
                null;
    });
}

//# sourceMappingURL=../../../out/node/extension/extension.js.map
