"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const NODE_SHEBANG_MATCHER = new RegExp('#! */usr/bin/env +node');
function isJavaScript(aPath) {
    const name = path.basename(aPath).toLowerCase();
    if (name.endsWith('.js')) {
        return true;
    }
    try {
        const buffer = new Buffer(30);
        const fd = fs.openSync(aPath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        const line = buffer.toString();
        if (NODE_SHEBANG_MATCHER.test(line)) {
            return true;
        }
    }
    catch (e) {
        // silently ignore problems
    }
    return false;
}
exports.isJavaScript = isJavaScript;
function random(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}
exports.random = random;
function killTree(processId) {
    if (process.platform === 'win32') {
        const TASK_KILL = 'C:\\Windows\\System32\\taskkill.exe';
        // when killing a process in Windows its child processes are *not* killed but become root processes.
        // Therefore we use TASKKILL.EXE
        try {
            cp.execSync(`${TASK_KILL} /F /T /PID ${processId}`);
        }
        catch (err) {
        }
    }
    else {
        // on linux and OS X we kill all direct and indirect child processes as well
        try {
            const cmd = path.join(__dirname, './terminateProcess.sh');
            cp.spawnSync(cmd, [processId.toString()]);
        }
        catch (err) {
        }
    }
}
exports.killTree = killTree;
function isOnPath(program) {
    if (process.platform === 'win32') {
        const WHERE = 'C:\\Windows\\System32\\where.exe';
        try {
            if (fs.existsSync(WHERE)) {
                cp.execSync(`${WHERE} ${program}`);
            }
            else {
                // do not report error if 'where' doesn't exist
            }
            return true;
        }
        catch (Exception) {
            // ignore
        }
    }
    else {
        const WHICH = '/usr/bin/which';
        try {
            if (fs.existsSync(WHICH)) {
                cp.execSync(`${WHICH} '${program}'`);
            }
            else {
                // do not report error if 'which' doesn't exist
            }
            return true;
        }
        catch (Exception) {
        }
    }
    return false;
}
exports.isOnPath = isOnPath;
function trimLastNewline(msg) {
    return msg.replace(/(\n|\r\n)$/, '');
}
exports.trimLastNewline = trimLastNewline;
function extendObject(toObject, fromObject) {
    for (let key in fromObject) {
        if (fromObject.hasOwnProperty(key)) {
            toObject[key] = fromObject[key];
        }
    }
    return toObject;
}
exports.extendObject = extendObject;
function stripBOM(s) {
    if (s && s[0] === '\uFEFF') {
        s = s.substr(1);
    }
    return s;
}
exports.stripBOM = stripBOM;

//# sourceMappingURL=utils.js.map
