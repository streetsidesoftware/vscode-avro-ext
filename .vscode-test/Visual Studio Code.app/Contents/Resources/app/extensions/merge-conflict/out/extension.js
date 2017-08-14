"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
nls.config(process.env.VSCODE_NLS_CONFIG)(__filename);
const services_1 = require("./services");
function activate(context) {
    // Register disposables
    const services = new services_1.default(context);
    services.begin();
    context.subscriptions.push(services);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/merge-conflict/out/extension.js.map
