"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscode_emmet_helper_1 = require("vscode-emmet-helper");
const abbreviationActions_1 = require("./abbreviationActions");
const util_1 = require("./util");
class DefaultCompletionItemProvider {
    provideCompletionItems(document, position, token) {
        const mappedLanguages = util_1.getMappingForIncludedLanguages();
        let isSyntaxMapped = mappedLanguages[document.languageId] ? true : false;
        let syntax = vscode_emmet_helper_1.getEmmetMode(isSyntaxMapped ? mappedLanguages[document.languageId] : document.languageId);
        if (document.languageId === 'html' || vscode_emmet_helper_1.isStyleSheet(document.languageId)) {
            // Document can be html/css parsed
            // Use syntaxHelper to parse file, validate location and update sytnax if needed
            syntax = this.syntaxHelper(syntax, document, position);
        }
        if (!syntax
            || ((isSyntaxMapped || syntax === 'jsx')
                && vscode.workspace.getConfiguration('emmet')['showExpandedAbbreviation'] !== 'always')) {
            return;
        }
        const emmetCompletionProvider = new vscode_emmet_helper_1.EmmetCompletionItemProvider(syntax);
        return emmetCompletionProvider.provideCompletionItems(document, position, token);
    }
    /**
     * Parses given document to check whether given position is valid for emmet abbreviation and returns appropriate syntax
     * @param syntax string language mode of current document
     * @param document vscode.Textdocument
     * @param position vscode.Position position of the abbreviation that needs to be expanded
     */
    syntaxHelper(syntax, document, position) {
        if (!syntax) {
            return syntax;
        }
        let rootNode = util_1.parse(document, false);
        if (!rootNode) {
            return;
        }
        let currentNode = util_1.getNode(rootNode, position);
        if (!vscode_emmet_helper_1.isStyleSheet(syntax)) {
            const currentHtmlNode = currentNode;
            if (currentHtmlNode
                && currentHtmlNode.close
                && currentHtmlNode.name === 'style'
                && util_1.getInnerRange(currentHtmlNode).contains(position)) {
                return 'css';
            }
        }
        if (!abbreviationActions_1.isValidLocationForEmmetAbbreviation(currentNode, syntax, position)) {
            return;
        }
        return syntax;
    }
}
exports.DefaultCompletionItemProvider = DefaultCompletionItemProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/emmet/out/defaultCompletionProvider.js.map
