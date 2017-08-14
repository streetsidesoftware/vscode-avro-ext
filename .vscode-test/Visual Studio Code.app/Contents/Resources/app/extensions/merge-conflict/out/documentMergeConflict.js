"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const interfaces = require("./interfaces");
class DocumentMergeConflict {
    constructor(document, descriptor) {
        this.range = descriptor.range;
        this.current = descriptor.current;
        this.incoming = descriptor.incoming;
        this.commonAncestors = descriptor.commonAncestors;
        this.splitter = descriptor.splitter;
    }
    commitEdit(type, editor, edit) {
        if (edit) {
            this.applyEdit(type, editor, edit);
            return Promise.resolve(true);
        }
        ;
        return editor.edit((edit) => this.applyEdit(type, editor, edit));
    }
    applyEdit(type, editor, edit) {
        // Each conflict is a set of ranges as follows, note placements or newlines
        // which may not in in spans
        // [ Conflict Range             -- (Entire content below)
        //   [ Current Header ]\n       -- >>>>> Header
        //   [ Current Content ]        -- (content)
        //   [ Splitter ]\n             -- =====
        //   [ Incoming Content ]       -- (content)
        //   [ Incoming Header ]\n      -- <<<<< Incoming
        // ]
        if (type === interfaces.CommitType.Current) {
            // Replace [ Conflict Range ] with [ Current Content ]
            let content = editor.document.getText(this.current.content);
            this.replaceRangeWithContent(content, edit);
        }
        else if (type === interfaces.CommitType.Incoming) {
            let content = editor.document.getText(this.incoming.content);
            this.replaceRangeWithContent(content, edit);
        }
        else if (type === interfaces.CommitType.Both) {
            // Replace [ Conflict Range ] with [ Current Content ] + \n + [ Incoming Content ]
            const currentContent = editor.document.getText(this.current.content);
            const incomingContent = editor.document.getText(this.incoming.content);
            edit.replace(this.range, currentContent.concat(incomingContent));
        }
    }
    replaceRangeWithContent(content, edit) {
        if (this.isNewlineOnly(content)) {
            edit.replace(this.range, '');
            return;
        }
        // Replace [ Conflict Range ] with [ Current Content ]
        edit.replace(this.range, content);
    }
    isNewlineOnly(text) {
        return text === '\n' || text === '\r\n';
    }
}
exports.DocumentMergeConflict = DocumentMergeConflict;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/cb82febafda0c8c199b9201ad274e25d9a76874e/extensions/merge-conflict/out/documentMergeConflict.js.map
