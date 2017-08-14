"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const defaultCompletionProvider_1 = require("./defaultCompletionProvider");
const abbreviationActions_1 = require("./abbreviationActions");
const removeTag_1 = require("./removeTag");
const updateTag_1 = require("./updateTag");
const matchTag_1 = require("./matchTag");
const balance_1 = require("./balance");
const splitJoinTag_1 = require("./splitJoinTag");
const mergeLines_1 = require("./mergeLines");
const toggleComment_1 = require("./toggleComment");
const editPoint_1 = require("./editPoint");
const selectItem_1 = require("./selectItem");
const evaluateMathExpression_1 = require("./evaluateMathExpression");
const incrementDecrement_1 = require("./incrementDecrement");
const util_1 = require("./util");
const vscode_emmet_helper_1 = require("vscode-emmet-helper");
function activate(context) {
    let completionProvider = new defaultCompletionProvider_1.DefaultCompletionItemProvider();
    Object.keys(util_1.LANGUAGE_MODES).forEach(language => {
        const provider = vscode.languages.registerCompletionItemProvider(language, completionProvider, ...util_1.LANGUAGE_MODES[language]);
        context.subscriptions.push(provider);
    });
    let includedLanguages = util_1.getMappingForIncludedLanguages();
    Object.keys(includedLanguages).forEach(language => {
        const provider = vscode.languages.registerCompletionItemProvider(language, completionProvider, ...util_1.LANGUAGE_MODES[includedLanguages[language]]);
        context.subscriptions.push(provider);
    });
    context.subscriptions.push(vscode.commands.registerCommand('emmet.wrapWithAbbreviation', (args) => {
        abbreviationActions_1.wrapWithAbbreviation(args);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.expandAbbreviation', (args) => {
        abbreviationActions_1.expandAbbreviation(args);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.removeTag', () => {
        removeTag_1.removeTag();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.updateTag', () => {
        vscode.window.showInputBox({ prompt: 'Enter Tag' }).then(tagName => {
            updateTag_1.updateTag(tagName);
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.matchTag', () => {
        matchTag_1.matchTag();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.balanceOut', () => {
        balance_1.balanceOut();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.balanceIn', () => {
        balance_1.balanceIn();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.splitJoinTag', () => {
        splitJoinTag_1.splitJoinTag();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.mergeLines', () => {
        mergeLines_1.mergeLines();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.toggleComment', () => {
        toggleComment_1.toggleComment();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.nextEditPoint', () => {
        editPoint_1.fetchEditPoint('next');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.prevEditPoint', () => {
        editPoint_1.fetchEditPoint('prev');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.selectNextItem', () => {
        selectItem_1.fetchSelectItem('next');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.selectPrevItem', () => {
        selectItem_1.fetchSelectItem('prev');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.evaluateMathExpression', () => {
        evaluateMathExpression_1.evaluateMathExpression();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.incrementNumberByOneTenth', () => {
        incrementDecrement_1.incrementDecrement(.1);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.incrementNumberByOne', () => {
        incrementDecrement_1.incrementDecrement(1);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.incrementNumberByTen', () => {
        incrementDecrement_1.incrementDecrement(10);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.decrementNumberByOneTenth', () => {
        incrementDecrement_1.incrementDecrement(-0.1);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.decrementNumberByOne', () => {
        incrementDecrement_1.incrementDecrement(-1);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('emmet.decrementNumberByTen', () => {
        incrementDecrement_1.incrementDecrement(-10);
    }));
    vscode_emmet_helper_1.updateExtensionsPath();
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        vscode_emmet_helper_1.updateExtensionsPath();
    }));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/emmet/out/extension.js.map
