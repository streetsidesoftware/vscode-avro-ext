/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var vscode_1 = require("vscode");
var Trace;
(function (Trace) {
    Trace[Trace["Off"] = 0] = "Off";
    Trace[Trace["Verbose"] = 1] = "Verbose";
})(Trace || (Trace = {}));
(function (Trace) {
    function fromString(value) {
        value = value.toLowerCase();
        switch (value) {
            case 'off':
                return Trace.Off;
            case 'verbose':
                return Trace.Verbose;
            default:
                return Trace.Off;
        }
    }
    Trace.fromString = fromString;
})(Trace || (Trace = {}));
function isString(value) {
    return Object.prototype.toString.call(value) === '[object String]';
}
var Logger = (function () {
    function Logger() {
        this.updateConfiguration();
    }
    Logger.prototype.log = function (message, data) {
        if (this.trace === Trace.Verbose) {
            this.output.appendLine("[Log - " + (new Date().toLocaleTimeString()) + "] " + message);
            if (data) {
                this.output.appendLine(this.data2String(data));
            }
        }
    };
    Logger.prototype.updateConfiguration = function () {
        this.trace = this.readTrace();
    };
    Object.defineProperty(Logger.prototype, "output", {
        get: function () {
            if (!this._output) {
                this._output = vscode_1.window.createOutputChannel('Markdown');
            }
            return this._output;
        },
        enumerable: true,
        configurable: true
    });
    Logger.prototype.readTrace = function () {
        return Trace.fromString(vscode_1.workspace.getConfiguration().get('markdown.trace', 'off'));
    };
    Logger.prototype.data2String = function (data) {
        if (data instanceof Error) {
            if (isString(data.stack)) {
                return data.stack;
            }
            return data.message;
        }
        if (isString(data)) {
            return data;
        }
        return JSON.stringify(data, undefined, 2);
    };
    return Logger;
}());
exports.Logger = Logger;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/markdown/out/logger.js.map
