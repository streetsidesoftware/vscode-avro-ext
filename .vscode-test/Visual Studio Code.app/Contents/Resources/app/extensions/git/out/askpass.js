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
const vscode_1 = require("vscode");
const util_1 = require("./util");
const path = require("path");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const randomBytes = util_1.denodeify(crypto.randomBytes);
function getIPCHandlePath(nonce) {
    if (process.platform === 'win32') {
        return `\\\\.\\pipe\\vscode-git-askpass-${nonce}-sock`;
    }
    if (process.env['XDG_RUNTIME_DIR']) {
        return path.join(process.env['XDG_RUNTIME_DIR'], `vscode-git-askpass-${nonce}.sock`);
    }
    return path.join(os.tmpdir(), `vscode-git-askpass-${nonce}.sock`);
}
class Askpass {
    constructor() {
        this.enabled = true;
        this.server = http.createServer((req, res) => this.onRequest(req, res));
        this.ipcHandlePathPromise = this.setup().catch(err => console.error(err));
    }
    setup() {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield randomBytes(20);
            const nonce = buffer.toString('hex');
            const ipcHandlePath = getIPCHandlePath(nonce);
            try {
                this.server.listen(ipcHandlePath);
                this.server.on('error', err => console.error(err));
            }
            catch (err) {
                console.error('Could not launch git askpass helper.');
                this.enabled = false;
            }
            return ipcHandlePath;
        });
    }
    onRequest(req, res) {
        const chunks = [];
        req.setEncoding('utf8');
        req.on('data', (d) => chunks.push(d));
        req.on('end', () => {
            const { request, host } = JSON.parse(chunks.join(''));
            this.prompt(host, request).then(result => {
                res.writeHead(200);
                res.end(JSON.stringify(result));
            }, () => {
                res.writeHead(500);
                res.end();
            });
        });
    }
    prompt(host, request) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                password: /password/i.test(request),
                placeHolder: request,
                prompt: `Git: ${host}`,
                ignoreFocusOut: true
            };
            return (yield vscode_1.window.showInputBox(options)) || '';
        });
    }
    getEnv() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.enabled) {
                return {
                    GIT_ASKPASS: path.join(__dirname, 'askpass-empty.sh')
                };
            }
            return {
                ELECTRON_RUN_AS_NODE: '1',
                GIT_ASKPASS: path.join(__dirname, 'askpass.sh'),
                VSCODE_GIT_ASKPASS_NODE: process.execPath,
                VSCODE_GIT_ASKPASS_MAIN: path.join(__dirname, 'askpass-main.js'),
                VSCODE_GIT_ASKPASS_HANDLE: yield this.ipcHandlePathPromise
            };
        });
    }
    dispose() {
        this.server.close();
    }
}
exports.Askpass = Askpass;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/git/out/askpass.js.map
