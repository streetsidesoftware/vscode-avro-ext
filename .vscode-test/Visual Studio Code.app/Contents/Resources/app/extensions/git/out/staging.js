/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
function applyLineChanges(original, modified, diffs) {
    const result = [];
    let currentLine = 0;
    for (let diff of diffs) {
        const isInsertion = diff.originalEndLineNumber === 0;
        const isDeletion = diff.modifiedEndLineNumber === 0;
        result.push(original.getText(new vscode_1.Range(currentLine, 0, isInsertion ? diff.originalStartLineNumber : diff.originalStartLineNumber - 1, 0)));
        if (!isDeletion) {
            let fromLine = diff.modifiedStartLineNumber - 1;
            let fromCharacter = 0;
            if (isInsertion && diff.originalStartLineNumber === original.lineCount) {
                fromLine = original.lineCount - 1;
                fromCharacter = original.lineAt(fromLine).range.end.character;
            }
            result.push(modified.getText(new vscode_1.Range(fromLine, fromCharacter, diff.modifiedEndLineNumber, 0)));
        }
        currentLine = isInsertion ? diff.originalStartLineNumber : diff.originalEndLineNumber;
    }
    result.push(original.getText(new vscode_1.Range(currentLine, 0, original.lineCount, 0)));
    return result.join('');
}
exports.applyLineChanges = applyLineChanges;
function toLineRanges(selections, textDocument) {
    const lineRanges = selections.map(s => {
        const startLine = textDocument.lineAt(s.start.line);
        const endLine = textDocument.lineAt(s.end.line);
        return new vscode_1.Range(startLine.range.start, endLine.range.end);
    });
    lineRanges.sort((a, b) => a.start.line - b.start.line);
    const result = lineRanges.reduce((result, l) => {
        if (result.length === 0) {
            result.push(l);
            return result;
        }
        const [last, ...rest] = result;
        const intersection = l.intersection(last);
        if (intersection) {
            return [intersection, ...rest];
        }
        if (l.start.line === last.end.line + 1) {
            const merge = new vscode_1.Range(last.start, l.end);
            return [merge, ...rest];
        }
        return [l, ...result];
    }, []);
    result.reverse();
    return result;
}
exports.toLineRanges = toLineRanges;
function getModifiedRange(textDocument, diff) {
    return diff.modifiedEndLineNumber === 0
        ? new vscode_1.Range(textDocument.lineAt(diff.modifiedStartLineNumber - 1).range.end, textDocument.lineAt(diff.modifiedStartLineNumber).range.start)
        : new vscode_1.Range(textDocument.lineAt(diff.modifiedStartLineNumber - 1).range.start, textDocument.lineAt(diff.modifiedEndLineNumber - 1).range.end);
}
function intersectDiffWithRange(textDocument, diff, range) {
    const modifiedRange = getModifiedRange(textDocument, diff);
    const intersection = range.intersection(modifiedRange);
    if (!intersection) {
        return null;
    }
    if (diff.modifiedEndLineNumber === 0) {
        return diff;
    }
    else {
        return {
            originalStartLineNumber: diff.originalStartLineNumber,
            originalEndLineNumber: diff.originalEndLineNumber,
            modifiedStartLineNumber: intersection.start.line + 1,
            modifiedEndLineNumber: intersection.end.line + 1
        };
    }
}
exports.intersectDiffWithRange = intersectDiffWithRange;
function invertLineChange(diff) {
    return {
        modifiedStartLineNumber: diff.originalStartLineNumber,
        modifiedEndLineNumber: diff.originalEndLineNumber,
        originalStartLineNumber: diff.modifiedStartLineNumber,
        originalEndLineNumber: diff.modifiedEndLineNumber
    };
}
exports.invertLineChange = invertLineChange;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/git/out/staging.js.map
