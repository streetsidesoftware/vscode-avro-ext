"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const is = require("./is");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle(__filename);
class Logger {
    get output() {
        if (!this._output) {
            this._output = vscode_1.window.createOutputChannel(localize(0, null));
        }
        return this._output;
    }
    data2String(data) {
        if (data instanceof Error) {
            if (is.string(data.stack)) {
                return data.stack;
            }
            return data.message;
        }
        if (is.boolean(data.success) && !data.success && is.string(data.message)) {
            return data.message;
        }
        if (is.string(data)) {
            return data;
        }
        return data.toString();
    }
    info(message, data) {
        this.logLevel('Info', message, data);
    }
    warn(message, data) {
        this.logLevel('Warn', message, data);
    }
    error(message, data) {
        // See https://github.com/Microsoft/TypeScript/issues/10496
        if (data && data.message === 'No content available.') {
            return;
        }
        this.logLevel('Error', message, data);
    }
    logLevel(level, message, data) {
        this.output.appendLine(`[${level}  - ${(new Date().toLocaleTimeString())}] ${message}`);
        if (data) {
            this.output.appendLine(this.data2String(data));
        }
    }
}
exports.default = Logger;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/typescript/out/utils/logger.js.map
