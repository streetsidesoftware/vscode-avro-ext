"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const telemetry = vscode_chrome_debug_core_1.telemetry.telemetry;
const vscode_debugadapter_1 = require("vscode-debugadapter");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const pathUtils = require("./pathUtils");
const utils = require("./utils");
const errors = require("./errors");
const nls = require("vscode-nls");
const localize = nls.config(process.env.VSCODE_NLS_CONFIG)();
const DefaultSourceMapPathOverrides = {
    'webpack:///./*': '${cwd}/*',
    'webpack:///*': '*',
    'meteor://💻app/*': '${cwd}/*',
};
class NodeDebugAdapter extends vscode_chrome_debug_core_1.ChromeDebugAdapter {
    constructor() {
        super(...arguments);
        // Flags relevant during init
        this._continueAfterConfigDone = true;
        this._waitingForEntryPauseEvent = true;
        this._finishedConfig = false;
        this._handlingEarlyNodeMsgs = true;
    }
    initialize(args) {
        this._supportsRunInTerminalRequest = args.supportsRunInTerminalRequest;
        this._adapterID = args.adapterID;
        return super.initialize(args);
    }
    launch(args) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            yield _super("launch").call(this, args);
            if (args.__restart && typeof args.__restart.port === 'number') {
                return this.doAttach(args.__restart.port, undefined, args.address, args.timeout);
            }
            const port = args.port || utils.random(3000, 50000);
            let runtimeExecutable = args.runtimeExecutable;
            if (runtimeExecutable) {
                if (!path.isAbsolute(runtimeExecutable)) {
                    if (!pathUtils.isOnPath(runtimeExecutable)) {
                        return this.getRuntimeNotOnPathErrorResponse(runtimeExecutable);
                    }
                }
                else {
                    const re = pathUtils.findExecutable(runtimeExecutable);
                    if (!re) {
                        return this.getNotExistErrorResponse('runtimeExecutable', runtimeExecutable);
                    }
                    runtimeExecutable = re;
                }
            }
            else {
                if (!utils.isOnPath(NodeDebugAdapter.NODE)) {
                    return Promise.reject(errors.runtimeNotFound(NodeDebugAdapter.NODE));
                }
                // use node from PATH
                runtimeExecutable = NodeDebugAdapter.NODE;
            }
            if (this._adapterID === 'extensionHost') {
                // we always launch in 'debug-brk' mode, but we only show the break event if 'stopOnEntry' attribute is true.
                let launchArgs = [];
                if (!args.noDebug) {
                    launchArgs.push(`--debugBrkPluginHost=${port}`, '--inspect');
                }
                const runtimeArgs = args.runtimeArgs || [];
                const programArgs = args.args || [];
                launchArgs = launchArgs.concat(runtimeArgs, programArgs);
                return this.launchInInternalConsole(runtimeExecutable, launchArgs);
            }
            let programPath = args.program;
            if (programPath) {
                if (!path.isAbsolute(programPath)) {
                    return this.getRelativePathErrorResponse('program', programPath);
                }
                if (!fs.existsSync(programPath)) {
                    programPath += '.js';
                    if (!fs.existsSync(programPath)) {
                        return this.getNotExistErrorResponse('program', programPath);
                    }
                }
                programPath = path.normalize(programPath);
                if (pathUtils.normalizeDriveLetter(programPath) !== pathUtils.realPath(programPath)) {
                    vscode_chrome_debug_core_1.logger.warn(localize('program.path.case.mismatch.warning', "Program path uses differently cased character as file on disk; this might result in breakpoints not being hit."));
                }
            }
            return this.resolveProgramPath(programPath, args.sourceMaps).then(resolvedProgramPath => {
                let program;
                let cwd = args.cwd;
                if (cwd) {
                    if (!path.isAbsolute(cwd)) {
                        return this.getRelativePathErrorResponse('cwd', cwd);
                    }
                    if (!fs.existsSync(cwd)) {
                        return this.getNotExistErrorResponse('cwd', cwd);
                    }
                    // if working dir is given and if the executable is within that folder, we make the executable path relative to the working dir
                    if (resolvedProgramPath) {
                        program = path.relative(cwd, resolvedProgramPath);
                    }
                }
                else if (resolvedProgramPath) {
                    // if no working dir given, we use the direct folder of the executable
                    cwd = path.dirname(resolvedProgramPath);
                    program = path.basename(resolvedProgramPath);
                }
                const runtimeArgs = args.runtimeArgs || [];
                const programArgs = args.args || [];
                let launchArgs = [runtimeExecutable];
                if (!args.noDebug && !args.port) {
                    launchArgs.push(`--inspect=${port}`);
                    // Always stop on entry to set breakpoints
                    launchArgs.push('--debug-brk');
                }
                this._continueAfterConfigDone = !args.stopOnEntry;
                launchArgs = launchArgs.concat(runtimeArgs, program ? [program] : [], programArgs);
                const envArgs = this.collectEnvFileArgs(args) || args.env;
                let launchP;
                if (args.console === 'integratedTerminal' || args.console === 'externalTerminal') {
                    const termArgs = {
                        kind: args.console === 'integratedTerminal' ? 'integrated' : 'external',
                        title: localize('node.console.title', "Node Debug Console"),
                        cwd,
                        args: launchArgs,
                        env: envArgs
                    };
                    launchP = this.launchInTerminal(termArgs);
                }
                else if (!args.console || args.console === 'internalConsole') {
                    // merge environment variables into a copy of the process.env
                    const env = Object.assign({}, process.env, envArgs);
                    launchP = this.launchInInternalConsole(runtimeExecutable, launchArgs.slice(1), { cwd, env });
                }
                else {
                    return Promise.reject(errors.unknownConsoleType(args.console));
                }
                return launchP
                    .then(() => {
                    return args.noDebug ?
                        Promise.resolve() :
                        this.doAttach(port, undefined, args.address, args.timeout);
                });
            });
        });
    }
    attach(args) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield _super("attach").call(this, args);
            }
            catch (err) {
                if (err.format && err.format.indexOf('Cannot connect to runtime process') >= 0) {
                    // hack -core error msg
                    err.format = 'Ensure Node was launched with --inspect. ' + err.format;
                }
                throw err;
            }
            ;
        });
    }
    commonArgs(args) {
        args.sourceMapPathOverrides = getSourceMapPathOverrides(args.cwd, args.sourceMapPathOverrides);
        fixNodeInternalsSkipFiles(args);
        args.showAsyncStacks = typeof args.showAsyncStacks === 'undefined' || args.showAsyncStacks;
        this._restartMode = args.restart;
        super.commonArgs(args);
    }
    hookConnectionEvents() {
        super.hookConnectionEvents();
        this.chrome.Runtime.onExecutionContextDestroyed(params => {
            if (params.executionContextId === 1) {
                this.terminateSession('Program ended');
            }
        });
    }
    doAttach(port, targetUrl, address, timeout) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            yield _super("doAttach").call(this, port, targetUrl, address, timeout);
            this.beginWaitingForDebuggerPaused();
            this.getNodeProcessDetailsIfNeeded();
            const supportsStepBack = yield this.supportsStepBack();
            return { supportsStepBack };
        });
    }
    supportsStepBack() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { domains } = yield this.chrome.Schema.getDomains();
                return !!domains.find(d => d.name === 'TimeTravel');
            }
            catch (e) {
                // API not supported by runtime
                return Promise.resolve(false);
            }
        });
    }
    launchInTerminal(termArgs) {
        return new Promise((resolve, reject) => {
            this._session.sendRequest('runInTerminal', termArgs, NodeDebugAdapter.RUNINTERMINAL_TIMEOUT, response => {
                if (response.success) {
                    // since node starts in a terminal, we cannot track it with an 'exit' handler
                    // plan for polling after we have gotten the process pid.
                    this._pollForNodeProcess = true;
                    resolve();
                }
                else {
                    reject(errors.cannotLaunchInTerminal(response.message));
                    this.terminateSession('terminal error: ' + response.message);
                }
            });
        });
    }
    launchInInternalConsole(runtimeExecutable, launchArgs, spawnOpts) {
        this.logLaunchCommand(runtimeExecutable, launchArgs);
        const nodeProcess = cp.spawn(runtimeExecutable, launchArgs, spawnOpts);
        return new Promise((resolve, reject) => {
            this._nodeProcessId = nodeProcess.pid;
            nodeProcess.on('error', (error) => {
                reject(errors.cannotLaunchDebugTarget(errors.toString()));
                const msg = `Node process error: ${error}`;
                vscode_chrome_debug_core_1.logger.error(msg);
                this.terminateSession(msg);
            });
            nodeProcess.on('exit', () => {
                const msg = 'Target exited';
                vscode_chrome_debug_core_1.logger.log(msg);
                this.terminateSession(msg);
            });
            nodeProcess.on('close', (code) => {
                const msg = 'Target closed';
                vscode_chrome_debug_core_1.logger.log(msg);
                this.terminateSession(msg);
            });
            const noDebugMode = this._launchAttachArgs.noDebug;
            this.captureStderr(nodeProcess, noDebugMode);
            // Must attach a listener to stdout or process will hang on Windows
            nodeProcess.stdout.on('data', (data) => {
                // If only running, use stdout/stderr instead of debug protocol logs
                if (noDebugMode) {
                    let msg = data.toString();
                    this._session.sendEvent(new vscode_debugadapter_1.OutputEvent(msg, 'stdout'));
                }
            });
            resolve();
        });
    }
    captureStderr(nodeProcess, noDebugMode) {
        nodeProcess.stderr.on('data', (data) => {
            let msg = data.toString();
            let isLastEarlyNodeMsg = false;
            // We want to send initial stderr output back to the console because they can contain useful errors.
            // But there are some messages printed to stderr at the start of debugging that can be misleading.
            // Node is "handlingEarlyNodeMsgs" from launch to when one of these messages is printed:
            //   "To start debugging, open the following URL in Chrome: ..." - Node <8
            //   --debug-brk deprecation message - Node 8+
            // In this mode, we strip those messages from stderr output. After one of them is printed, we don't
            // watch stderr anymore and pass it along (unless in noDebugMode).
            if (this._handlingEarlyNodeMsgs && !noDebugMode) {
                const chromeMsgIndex = msg.indexOf('To start debugging, open the following URL in Chrome:');
                if (chromeMsgIndex >= 0) {
                    msg = msg.substr(0, chromeMsgIndex);
                    isLastEarlyNodeMsg = true;
                }
                const msgMatch = msg.match(NodeDebugAdapter.DEBUG_BRK_DEP_MSG);
                if (msgMatch) {
                    isLastEarlyNodeMsg = true;
                    msg = msg.replace(NodeDebugAdapter.DEBUG_BRK_DEP_MSG, '');
                }
                const helpMsg = /For help see https:\/\/nodejs.org\/en\/docs\/inspector\s*/;
                msg = msg.replace(helpMsg, '');
            }
            if (this._handlingEarlyNodeMsgs || noDebugMode) {
                this._session.sendEvent(new vscode_debugadapter_1.OutputEvent(msg, 'stderr'));
            }
            if (isLastEarlyNodeMsg) {
                this._handlingEarlyNodeMsgs = false;
            }
        });
    }
    onConsoleAPICalled(params) {
        // Once any console API message is received, we are done listening to initial stderr output
        this._handlingEarlyNodeMsgs = false;
        // Strip the --debug-brk deprecation message which is printed at startup
        if (!params.args || params.args.length !== 1 || typeof params.args[0].value !== 'string' || !params.args[0].value.match(NodeDebugAdapter.DEBUG_BRK_DEP_MSG)) {
            super.onConsoleAPICalled(params);
        }
    }
    collectEnvFileArgs(args) {
        // read env from disk and merge into envVars
        if (args.envFile) {
            try {
                const env = {};
                const buffer = utils.stripBOM(fs.readFileSync(args.envFile, 'utf8'));
                buffer.split('\n').forEach(line => {
                    const r = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
                    if (r !== null) {
                        const key = r[1];
                        if (!process.env[key]) {
                            let value = r[2] || '';
                            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                                value = value.replace(/\\n/gm, '\n');
                            }
                            env[key] = value.replace(/(^['"]|['"]$)/g, '');
                        }
                    }
                });
                return utils.extendObject(env, args.env); // launch config env vars overwrite .env vars
            }
            catch (e) {
                throw errors.cannotLoadEnvVarsFromFile(e.message);
            }
        }
    }
    /**
     * Override so that -core's call on attach will be ignored, and we can wait until the first break when ready to set BPs.
     */
    sendInitializedEvent() {
        if (!this._waitingForEntryPauseEvent) {
            super.sendInitializedEvent();
        }
    }
    configurationDone() {
        if (!this.chrome) {
            // It's possible to get this request after we've detached, see #21973
            return super.configurationDone();
        }
        // This message means that all breakpoints have been set by the client. We should be paused at this point.
        // So tell the target to continue, or tell the client that we paused, as needed
        this._finishedConfig = true;
        if (this._continueAfterConfigDone) {
            this._expectingStopReason = undefined;
            this.continue(/*internal=*/ true);
        }
        else if (this._entryPauseEvent) {
            this.onPaused(this._entryPauseEvent);
        }
        return super.configurationDone();
    }
    killNodeProcess() {
        if (this._nodeProcessId && !this._attachMode) {
            vscode_chrome_debug_core_1.logger.log('Killing process with id: ' + this._nodeProcessId);
            utils.killTree(this._nodeProcessId);
            this._nodeProcessId = 0;
        }
    }
    terminateSession(reason) {
        const restartArgs = this._restartMode && !this._inShutdown ? { port: this._port } : undefined;
        this.killNodeProcess();
        super.terminateSession(reason, restartArgs);
    }
    onPaused(notification, expectingStopReason) {
        // If we don't have the entry location, this must be the entry pause
        if (this._waitingForEntryPauseEvent) {
            vscode_chrome_debug_core_1.logger.log('Paused on entry');
            this._expectingStopReason = 'entry';
            this._entryPauseEvent = notification;
            this._waitingForEntryPauseEvent = false;
            if (this._attachMode) {
                // In attach mode, and we did pause right away,
                // so assume --debug-brk was set and we should show paused
                this._continueAfterConfigDone = false;
            }
            this.getNodeProcessDetailsIfNeeded()
                .then(() => this.sendInitializedEvent());
        }
        else {
            super.onPaused(notification, expectingStopReason);
        }
    }
    resolveProgramPath(programPath, sourceMaps) {
        return Promise.resolve().then(() => {
            if (!programPath) {
                return programPath;
            }
            if (utils.isJavaScript(programPath)) {
                if (!sourceMaps) {
                    return programPath;
                }
                // if programPath is a JavaScript file and sourceMaps are enabled, we don't know whether
                // programPath is the generated file or whether it is the source (and we need source mapping).
                // Typically this happens if a tool like 'babel' or 'uglify' is used (because they both transpile js to js).
                // We use the source maps to find a 'source' file for the given js file.
                return this._sourceMapTransformer.getGeneratedPathFromAuthoredPath(programPath).then(generatedPath => {
                    if (generatedPath && generatedPath !== programPath) {
                        // programPath must be source because there seems to be a generated file for it
                        vscode_chrome_debug_core_1.logger.log(`Launch: program '${programPath}' seems to be the source; launch the generated file '${generatedPath}' instead`);
                        programPath = generatedPath;
                    }
                    else {
                        vscode_chrome_debug_core_1.logger.log(`Launch: program '${programPath}' seems to be the generated file`);
                    }
                    return programPath;
                });
            }
            else {
                // node cannot execute the program directly
                if (!sourceMaps) {
                    return Promise.reject(errors.cannotLaunchBecauseSourceMaps(programPath));
                }
                return this._sourceMapTransformer.getGeneratedPathFromAuthoredPath(programPath).then(generatedPath => {
                    if (!generatedPath) {
                        return Promise.reject(errors.cannotLaunchBecauseOutFiles(programPath));
                    }
                    vscode_chrome_debug_core_1.logger.log(`Launch: program '${programPath}' seems to be the source; launch the generated file '${generatedPath}' instead`);
                    return generatedPath;
                });
            }
        });
    }
    /**
     * Wait 500ms for the entry pause event, and if it doesn't come, move on with life.
     * During attach, we don't know whether it's paused when attaching.
     */
    beginWaitingForDebuggerPaused() {
        let count = 10;
        const id = setInterval(() => {
            if (this._entryPauseEvent || this._isTerminated) {
                // Got the entry pause, stop waiting
                clearInterval(id);
            }
            else if (--count <= 0) {
                // No entry event, so fake it and continue
                vscode_chrome_debug_core_1.logger.log('Did not get a pause event 500ms after starting, so continuing');
                clearInterval(id);
                this._continueAfterConfigDone = false;
                this._waitingForEntryPauseEvent = false;
                this.getNodeProcessDetailsIfNeeded()
                    .then(() => this.sendInitializedEvent());
            }
        }, 50);
    }
    threadName() {
        return `Node (${this._nodeProcessId})`;
    }
    /**
     * Override addBreakpoints, which is called by setBreakpoints to make the actual call to Chrome.
     */
    addBreakpoints(url, breakpoints) {
        return super.addBreakpoints(url, breakpoints).then(responses => {
            if (this._entryPauseEvent && !this._finishedConfig) {
                const entryLocation = this._entryPauseEvent.callFrames[0].location;
                if (this._continueAfterConfigDone) {
                    const bpAtEntryLocation = responses.some(response => {
                        // Don't compare column location, because you can have a bp at col 0, then break at some other column
                        return response && response.actualLocation && response.actualLocation.lineNumber === entryLocation.lineNumber &&
                            response.actualLocation.scriptId === entryLocation.scriptId;
                    });
                    if (bpAtEntryLocation) {
                        // There is some initial breakpoint being set to the location where we stopped on entry, so need to pause even if
                        // the stopOnEntry flag is not set
                        vscode_chrome_debug_core_1.logger.log('Got a breakpoint set in the entry location, so will stop even though stopOnEntry is not set');
                        this._continueAfterConfigDone = false;
                        this._expectingStopReason = 'breakpoint';
                    }
                }
            }
            return responses;
        });
    }
    getNodeProcessDetailsIfNeeded() {
        if (this._loggedTargetVersion || !this.chrome) {
            return Promise.resolve();
        }
        return this.chrome.Runtime.evaluate({ expression: '[process.pid, process.version, process.arch]', returnByValue: true, contextId: 1 }).then(response => {
            if (this._loggedTargetVersion) {
                // Possible to get two of these requests going simultaneously
                return;
            }
            if (response.exceptionDetails) {
                const description = vscode_chrome_debug_core_1.chromeUtils.errorMessageFromExceptionDetails(response.exceptionDetails);
                if (description.startsWith('ReferenceError: process is not defined')) {
                    vscode_chrome_debug_core_1.logger.verbose('Got expected exception: `process is not defined`. Will try again later.');
                }
                else {
                    vscode_chrome_debug_core_1.logger.log('Exception evaluating `process.pid`: ' + description + '. Will try again later.');
                }
            }
            else {
                const [pid, version, arch] = response.result.value;
                if (this._pollForNodeProcess) {
                    this._nodeProcessId = pid;
                    this.startPollingForNodeTermination();
                }
                this._loggedTargetVersion = true;
                vscode_chrome_debug_core_1.logger.log(`Target node version: ${version} ${arch}`);
                telemetry.reportEvent('nodeVersion', { version });
            }
        }, error => vscode_chrome_debug_core_1.logger.error('Error evaluating `process.pid`: ' + error.message));
    }
    startPollingForNodeTermination() {
        const intervalId = setInterval(() => {
            try {
                if (this._nodeProcessId) {
                    // kill with signal=0 just test for whether the proc is alive. It throws if not.
                    process.kill(this._nodeProcessId, 0);
                }
                else {
                    clearInterval(intervalId);
                }
            }
            catch (e) {
                clearInterval(intervalId);
                vscode_chrome_debug_core_1.logger.log('Target process died');
                this.terminateSession('Target process died');
            }
        }, NodeDebugAdapter.NODE_TERMINATION_POLL_INTERVAL);
    }
    logLaunchCommand(executable, args) {
        // print the command to launch the target to the debug console
        let cli = executable + ' ';
        for (let a of args) {
            if (a.indexOf(' ') >= 0) {
                cli += '\'' + a + '\'';
            }
            else {
                cli += a;
            }
            cli += ' ';
        }
        vscode_chrome_debug_core_1.logger.warn(cli);
    }
    globalEvaluate(args) {
        // contextId: 1 - see https://github.com/nodejs/node/issues/8426
        if (!args.contextId)
            args.contextId = 1;
        return super.globalEvaluate(args);
    }
    /**
     * 'Path does not exist' error
     */
    getNotExistErrorResponse(attribute, path) {
        return Promise.reject({
            id: 2007,
            format: localize('attribute.path.not.exist', "Attribute '{0}' does not exist ('{1}').", attribute, '{path}'),
            variables: { path }
        });
    }
    /**
     * 'Path not absolute' error with 'More Information' link.
     */
    getRelativePathErrorResponse(attribute, path) {
        const format = localize('attribute.path.not.absolute', "Attribute '{0}' is not absolute ('{1}'); consider adding '{2}' as a prefix to make it absolute.", attribute, '{path}', '${workspaceRoot}/');
        return this.getErrorResponseWithInfoLink(2008, format, { path }, 20003);
    }
    getRuntimeNotOnPathErrorResponse(runtime) {
        return Promise.reject({
            id: 2001,
            format: localize('VSND2001', "Cannot find runtime '{0}' on PATH.", '{_runtime}'),
            variables: { _runtime: runtime }
        });
    }
    /**
     * Send error response with 'More Information' link.
     */
    getErrorResponseWithInfoLink(code, format, variables, infoId) {
        return Promise.reject({
            id: code,
            format,
            variables,
            showUser: true,
            url: 'http://go.microsoft.com/fwlink/?linkID=534832#_' + infoId.toString(),
            urlLabel: localize('more.information', "More Information")
        });
    }
    getReadonlyOrigin(aPath) {
        return path.isAbsolute(aPath) || aPath.startsWith(vscode_chrome_debug_core_1.ChromeDebugAdapter.EVAL_NAME_PREFIX) ?
            localize('origin.from.node', "read-only content from Node.js") :
            localize('origin.core.module', "read-only core module");
    }
    /**
     * If realPath is an absolute path or a URL, return realPath. Otherwise, prepend the node_internals marker
     */
    realPathToDisplayPath(realPath) {
        if (realPath.match(/VM\d+/)) {
            return realPath;
        }
        return path.isAbsolute(realPath) ? realPath : `${NodeDebugAdapter.NODE_INTERNALS}/${realPath}`;
    }
    /**
     * If displayPath starts with the NODE_INTERNALS indicator, strip it.
     */
    displayPathToRealPath(displayPath) {
        const match = displayPath.match(new RegExp(`^${NodeDebugAdapter.NODE_INTERNALS}[\\\\/](.*)`));
        return match ? match[1] : displayPath;
    }
}
NodeDebugAdapter.NODE = 'node';
NodeDebugAdapter.RUNINTERMINAL_TIMEOUT = 5000;
NodeDebugAdapter.NODE_TERMINATION_POLL_INTERVAL = 3000;
NodeDebugAdapter.DEBUG_BRK_DEP_MSG = /\(node:\d+\) \[DEP0062\] DeprecationWarning: `node --inspect --debug-brk` is deprecated\. Please use `node --inspect-brk` instead\.\s*/;
NodeDebugAdapter.NODE_INTERNALS = '<node_internals>';
exports.NodeDebugAdapter = NodeDebugAdapter;
function getSourceMapPathOverrides(cwd, sourceMapPathOverrides) {
    return sourceMapPathOverrides ? resolveCwdPattern(cwd, sourceMapPathOverrides, /*warnOnMissing=*/ true) :
        resolveCwdPattern(cwd, DefaultSourceMapPathOverrides, /*warnOnMissing=*/ false);
}
function fixNodeInternalsSkipFiles(args) {
    if (args.skipFiles) {
        args.skipFileRegExps = args.skipFileRegExps || [];
        args.skipFiles = args.skipFiles.filter(pattern => {
            const fixed = fixNodeInternalsSkipFilePattern(pattern);
            if (fixed) {
                args.skipFileRegExps.push(fixed);
                return false;
            }
            else {
                return true;
            }
        });
    }
}
const internalsRegex = new RegExp(`^${NodeDebugAdapter.NODE_INTERNALS}/(.*)`);
function fixNodeInternalsSkipFilePattern(pattern) {
    const internalsMatch = pattern.match(internalsRegex);
    if (internalsMatch) {
        return `^(?!\/)(?![a-zA-Z]:)${vscode_chrome_debug_core_1.utils.pathGlobToBlackboxedRegex(internalsMatch[1])}`;
    }
    else {
        return null;
    }
}
/**
 * Returns a copy of sourceMapPathOverrides with the ${cwd} pattern resolved in all entries.
 */
function resolveCwdPattern(cwd, sourceMapPathOverrides, warnOnMissing) {
    const resolvedOverrides = {};
    for (let pattern in sourceMapPathOverrides) {
        const replacePattern = sourceMapPathOverrides[pattern];
        resolvedOverrides[pattern] = replacePattern;
        const cwdIndex = replacePattern.indexOf('${cwd}');
        if (cwdIndex === 0) {
            if (cwd) {
                resolvedOverrides[pattern] = replacePattern.replace('${cwd}', cwd);
            }
            else if (warnOnMissing) {
                vscode_chrome_debug_core_1.logger.log('Warning: sourceMapPathOverrides entry contains ${cwd}, but cwd is not set');
            }
        }
        else if (cwdIndex > 0) {
            vscode_chrome_debug_core_1.logger.log('Warning: in a sourceMapPathOverrides entry, ${cwd} is only valid at the beginning of the path');
        }
    }
    return resolvedOverrides;
}

//# sourceMappingURL=nodeDebugAdapter.js.map
