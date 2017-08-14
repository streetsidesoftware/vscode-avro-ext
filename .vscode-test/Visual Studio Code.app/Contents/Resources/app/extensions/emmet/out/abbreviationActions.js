"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const expand_abbreviation_1 = require("@emmetio/expand-abbreviation");
const util_1 = require("./util");
const vscode_emmet_helper_1 = require("vscode-emmet-helper");
function wrapWithAbbreviation(args) {
    const syntax = getSyntaxFromArgs(args);
    if (!syntax || !util_1.validate()) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    vscode.window.showInputBox({ prompt: 'Enter Abbreviation' }).then(abbreviation => {
        if (!abbreviation || !abbreviation.trim() || !vscode_emmet_helper_1.isAbbreviationValid(syntax, abbreviation)) {
            return;
        }
        let expandAbbrList = [];
        let firstTextToReplace;
        let allTextToReplaceSame = true;
        editor.selections.forEach(selection => {
            let rangeToReplace = selection.isReversed ? new vscode.Range(selection.active, selection.anchor) : selection;
            if (rangeToReplace.isEmpty) {
                rangeToReplace = new vscode.Range(rangeToReplace.start.line, 0, rangeToReplace.start.line, editor.document.lineAt(rangeToReplace.start.line).text.length);
            }
            const firstLine = editor.document.lineAt(rangeToReplace.start).text;
            const firstLineTillSelection = firstLine.substr(0, rangeToReplace.start.character);
            const noTextBeforeSelection = /^\s*$/.test(firstLineTillSelection);
            let textToWrap = '';
            let preceedingWhiteSpace = '';
            if (noTextBeforeSelection) {
                const matches = firstLine.match(/^(\s*)/);
                if (matches) {
                    preceedingWhiteSpace = matches[1];
                }
                if (rangeToReplace.start.character <= preceedingWhiteSpace.length) {
                    rangeToReplace = new vscode.Range(rangeToReplace.start.line, 0, rangeToReplace.end.line, rangeToReplace.end.character);
                }
                textToWrap = newLine;
                for (let i = rangeToReplace.start.line; i <= rangeToReplace.end.line; i++) {
                    textToWrap += '\t' + editor.document.lineAt(i).text.substr(preceedingWhiteSpace.length) + newLine;
                }
            }
            else {
                textToWrap = editor.document.getText(rangeToReplace);
            }
            if (!firstTextToReplace) {
                firstTextToReplace = textToWrap;
            }
            else if (allTextToReplaceSame && firstTextToReplace !== textToWrap) {
                allTextToReplaceSame = false;
            }
            expandAbbrList.push({ syntax, abbreviation, rangeToReplace, textToWrap, preceedingWhiteSpace });
        });
        expandAbbreviationInRange(editor, expandAbbrList, allTextToReplaceSame);
    });
}
exports.wrapWithAbbreviation = wrapWithAbbreviation;
function expandAbbreviation(args) {
    const syntax = getSyntaxFromArgs(args);
    if (!syntax || !util_1.validate()) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    let rootNode = util_1.parse(editor.document);
    if (!rootNode) {
        return;
    }
    let abbreviationList = [];
    let firstAbbreviation;
    let allAbbreviationsSame = true;
    editor.selections.forEach(selection => {
        let rangeToReplace = selection;
        let position = selection.isReversed ? selection.anchor : selection.active;
        let abbreviation = editor.document.getText(rangeToReplace);
        if (rangeToReplace.isEmpty) {
            [rangeToReplace, abbreviation] = vscode_emmet_helper_1.extractAbbreviation(editor.document, position);
        }
        if (!vscode_emmet_helper_1.isAbbreviationValid(syntax, abbreviation)) {
            vscode.window.showErrorMessage('Emmet: Invalid abbreviation');
            return;
        }
        let currentNode = util_1.getNode(rootNode, position);
        if (!isValidLocationForEmmetAbbreviation(currentNode, syntax, position)) {
            return;
        }
        if (!firstAbbreviation) {
            firstAbbreviation = abbreviation;
        }
        else if (allAbbreviationsSame && firstAbbreviation !== abbreviation) {
            allAbbreviationsSame = false;
        }
        abbreviationList.push({ syntax, abbreviation, rangeToReplace });
    });
    expandAbbreviationInRange(editor, abbreviationList, allAbbreviationsSame);
}
exports.expandAbbreviation = expandAbbreviation;
/**
 * Checks if given position is a valid location to expand emmet abbreviation.
 * Works only on html and css/less/scss syntax
 * @param currentNode parsed node at given position
 * @param syntax syntax of the abbreviation
 * @param position position to validate
 */
function isValidLocationForEmmetAbbreviation(currentNode, syntax, position) {
    if (!currentNode) {
        return true;
    }
    if (vscode_emmet_helper_1.isStyleSheet(syntax)) {
        if (currentNode.type !== 'rule') {
            return true;
        }
        const currentCssNode = currentNode;
        return currentCssNode.selectorToken && position.isAfter(currentCssNode.selectorToken.end);
    }
    const currentHtmlNode = currentNode;
    if (currentHtmlNode.close) {
        return util_1.getInnerRange(currentHtmlNode).contains(position);
    }
    return false;
}
exports.isValidLocationForEmmetAbbreviation = isValidLocationForEmmetAbbreviation;
/**
 * Expands abbreviations as detailed in expandAbbrList in the editor
 * @param editor
 * @param expandAbbrList
 * @param insertSameSnippet
 */
function expandAbbreviationInRange(editor, expandAbbrList, insertSameSnippet) {
    if (!expandAbbrList || expandAbbrList.length === 0) {
        return;
    }
    const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    // Snippet to replace at multiple cursors are not the same
    // `editor.insertSnippet` will have to be called for each instance separately
    // We will not be able to maintain multiple cursors after snippet insertion
    if (!insertSameSnippet) {
        expandAbbrList.forEach((expandAbbrInput) => {
            let expandedText = expandAbbr(expandAbbrInput, newLine);
            if (expandedText) {
                editor.insertSnippet(new vscode.SnippetString(expandedText), expandAbbrInput.rangeToReplace);
            }
        });
        return;
    }
    // Snippet to replace at all cursors are the same
    // We can pass all ranges to `editor.insertSnippet` in a single call so that
    // all cursors are maintained after snippet insertion
    const anyExpandAbbrInput = expandAbbrList[0];
    let expandedText = expandAbbr(anyExpandAbbrInput, newLine);
    let allRanges = expandAbbrList.map(value => {
        return value.rangeToReplace;
    });
    if (expandedText) {
        editor.insertSnippet(new vscode.SnippetString(expandedText), allRanges);
    }
}
/**
 * Expands abbreviation as detailed in given input.
 * If there is textToWrap, then given preceedingWhiteSpace is applied
 */
function expandAbbr(input, newLine) {
    // Expand the abbreviation
    let expandedText;
    try {
        expandedText = expand_abbreviation_1.expand(input.abbreviation, vscode_emmet_helper_1.getExpandOptions(input.syntax, input.textToWrap));
    }
    catch (e) {
        vscode.window.showErrorMessage('Failed to expand abbreviation');
    }
    if (!expandedText) {
        return;
    }
    // If no text to wrap, then return the expanded text	
    if (!input.textToWrap) {
        return expandedText;
    }
    // There was text to wrap, and the final expanded text is multi line
    // So add the preceedingWhiteSpace to each line
    if (expandedText.indexOf('\n') > -1) {
        return expandedText.split(newLine).map(line => input.preceedingWhiteSpace + line).join(newLine);
    }
    // There was text to wrap and the final expanded text is single line
    // This can happen when the abbreviation was for an inline element
    // Remove the preceeding newLine + tab and the ending newLine, that was added to textToWrap
    // And re-expand the abbreviation
    let regex = newLine === '\n' ? /^\n\t(.*)\n$/ : /^\r\n\t(.*)\r\n$/;
    let matches = input.textToWrap.match(regex);
    if (matches) {
        input.textToWrap = matches[1];
        return expandAbbr(input, newLine);
    }
    return input.preceedingWhiteSpace + expandedText;
}
function getSyntaxFromArgs(args) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No editor is active.');
        return;
    }
    if (typeof args !== 'object' || !args['language']) {
        vscode.window.showInformationMessage('Cannot resolve language at cursor.');
        return;
    }
    const mappedModes = util_1.getMappingForIncludedLanguages();
    let language = args['language'];
    let parentMode = args['parentMode'];
    let syntax = vscode_emmet_helper_1.getEmmetMode(mappedModes[language] ? mappedModes[language] : language);
    if (syntax) {
        return syntax;
    }
    return vscode_emmet_helper_1.getEmmetMode(mappedModes[parentMode] ? mappedModes[parentMode] : parentMode);
}
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/emmet/out/abbreviationActions.js.map
