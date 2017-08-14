/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var nls = require("vscode-nls");
exports.localize = nls.config(process.env.VSCODE_NLS_CONFIG)(__filename);
function log(message) {
    vscode.commands.executeCommand('debug.logToDebugConsole', message + '\n');
}
exports.log = log;

//# sourceMappingURL=../../../out/node/extension/utilities.js.map
