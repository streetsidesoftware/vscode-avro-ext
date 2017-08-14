"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("./util");
function mergeLines() {
    let editor = vscode.window.activeTextEditor;
    if (!util_1.validate(false)) {
        return;
    }
    let rootNode = util_1.parse(editor.document);
    if (!rootNode) {
        return;
    }
    editor.edit(editBuilder => {
        editor.selections.reverse().forEach(selection => {
            let [rangeToReplace, textToReplaceWith] = getRangesToReplace(editor.document, selection, rootNode);
            if (rangeToReplace && textToReplaceWith) {
                editBuilder.replace(rangeToReplace, textToReplaceWith);
            }
        });
    });
}
exports.mergeLines = mergeLines;
function getRangesToReplace(document, selection, rootNode) {
    let startNodeToUpdate;
    let endNodeToUpdate;
    if (selection.isEmpty) {
        startNodeToUpdate = endNodeToUpdate = util_1.getNode(rootNode, selection.start);
    }
    else {
        startNodeToUpdate = util_1.getNode(rootNode, selection.start, true);
        endNodeToUpdate = util_1.getNode(rootNode, selection.end, true);
    }
    if (!startNodeToUpdate || !endNodeToUpdate) {
        return [null, null];
    }
    let rangeToReplace = new vscode.Range(startNodeToUpdate.start, endNodeToUpdate.end);
    let textToReplaceWith = document.getText(rangeToReplace).replace(/\r\n|\n/g, '').replace(/>\s*</g, '><');
    return [rangeToReplace, textToReplaceWith];
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/emmet/out/mergeLines.js.map
