"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("./util");
function splitJoinTag() {
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
exports.splitJoinTag = splitJoinTag;
function getRangesToReplace(document, selection, rootNode) {
    let nodeToUpdate = util_1.getNode(rootNode, selection.start);
    let rangeToReplace;
    let textToReplaceWith;
    if (!nodeToUpdate) {
        return [null, null];
    }
    if (!nodeToUpdate.close) {
        // Split Tag
        let nodeText = document.getText(new vscode.Range(nodeToUpdate.start, nodeToUpdate.end));
        let m = nodeText.match(/(\s*\/)?>$/);
        let end = nodeToUpdate.end;
        let start = m ? end.translate(0, -m[0].length) : end;
        rangeToReplace = new vscode.Range(start, end);
        textToReplaceWith = `></${nodeToUpdate.name}>`;
    }
    else {
        // Join Tag
        let start = nodeToUpdate.open.end.translate(0, -1);
        let end = nodeToUpdate.end;
        rangeToReplace = new vscode.Range(start, end);
        textToReplaceWith = '/>';
    }
    return [rangeToReplace, textToReplaceWith];
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/emmet/out/splitJoinTag.js.map
