"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
/* Based on @sergeche's work in his emmet plugin */
const vscode = require("vscode");
const math_expression_1 = require("@emmetio/math-expression");
const bufferStream_1 = require("./bufferStream");
function evaluateMathExpression() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No editor is active');
        return;
    }
    const stream = new bufferStream_1.DocumentStreamReader(editor.document);
    editor.edit(editBuilder => {
        editor.selections.forEach(selection => {
            const pos = selection.isReversed ? selection.anchor : selection.active;
            stream.pos = pos;
            try {
                const result = String(math_expression_1.default(stream, true));
                editBuilder.replace(new vscode.Range(stream.pos, pos), result);
            }
            catch (err) {
                // Ignore error since most likely it’s because of non-math expression
                console.warn('Math evaluation error', err);
            }
        });
    });
}
exports.evaluateMathExpression = evaluateMathExpression;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/emmet/out/evaluateMathExpression.js.map
