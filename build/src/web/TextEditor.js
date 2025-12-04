"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HTML_1 = require("./HTML");
const EventEmitter_1 = require("./EventEmitter");
exports.LEFT_ARROW_KEYCODE = 37;
exports.RIGHT_ARROW_KEYCODE = 39;
exports.ENTER_KEYCODE = 13;
class TextEditor extends EventEmitter_1.EventEmitter {
    constructor(config) {
        super({
            hooks: {
                change: {
                    init: () => this.ele.addEventListener('input', _checkChangeEvent),
                    clear: () => {
                        this.ele.removeEventListener('input', _checkChangeEvent);
                        clearTimeout(this._checkChangeDelayTask);
                    }
                },
                boundary: {
                    init: () => this.ele.addEventListener('keydown', _checkCaretBoundaryEvent),
                    clear: () => this.ele.removeEventListener('keydown', _checkCaretBoundaryEvent)
                }
            }
        });
        this.ele = HTML_1.h.div({ contentEditable: 'true', spellcheck: false });
        this._prevTextContent = '';
        this._checkChangeDelayTask = -1;
        this.config = Object.assign({}, TextEditor.defaultConfig, config || {});
        const _checkChangeEvent = this._checkChangeEvent.bind(this);
        const _checkCaretBoundaryEvent = (event) => {
            let keyCode = event.keyCode;
            if (keyCode === exports.LEFT_ARROW_KEYCODE || keyCode === exports.RIGHT_ARROW_KEYCODE) {
                if (String(getSelection()))
                    return;
                let b = keyCode === exports.LEFT_ARROW_KEYCODE ? 'Start' : 'End';
                if (this.isCaretAtBoundary(b)) {
                    this.emit('boundary', { boundary: b });
                    event.preventDefault();
                }
            }
        };
        if (!this.config.multiline) {
            this.ele.addEventListener('keydown', event => {
                if (event.keyCode === exports.ENTER_KEYCODE) {
                    event.preventDefault();
                }
            });
        }
    }
    focus(position = 'End') {
        this.ele.focus();
        let sel = getSelection();
        if (position === 'End') {
            let { lastChild } = this.ele;
            if (lastChild) {
                let range = sel.getRangeAt(0);
                range.setEndAfter(lastChild);
                range.collapse(false);
            }
        }
    }
    insertAt(content, position) {
        if (position === 'Start') {
            this.ele.prepend(content);
        }
        else if (position === 'End') {
            this.ele.append(content);
        }
        else {
            let sel = getSelection();
            let anchorNode = sel.anchorNode;
            if (!this.ele.contains(anchorNode)) {
                this.ele.append(content);
                return;
            }
            if (position === 'Caret') {
                if (typeof content === 'string') {
                    // preserve undo history
                    document.execCommand('insertText', false, content);
                }
                else {
                    let range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(content);
                }
                sel.collapseToEnd();
            }
            else {
                // TODO: Support number text offset position?
            }
        }
    }
    getTextContent() {
        return this.ele.textContent || '';
    }
    setTextContent(s) {
        this.ele.textContent = s;
        this._prevTextContent = s;
    }
    isCaretAtBoundary(boundary) {
        let sel = getSelection();
        let focusNode = sel.focusNode;
        let offset = sel.focusOffset;
        if (focusNode === this.ele) {
            if (!this.ele.textContent)
                return true;
            return offset === (boundary === 'Start' ? 0 : 1);
        }
        if (!this.ele.contains(focusNode))
            return boundary === 'End';
        if (boundary === 'Start' && offset !== 0)
            return false;
        let boundaryNode = this.ele;
        while (boundaryNode) {
            if (boundary === 'Start') {
                if (focusNode === boundaryNode)
                    return true;
                boundaryNode = boundaryNode.firstChild;
            }
            else if (boundary === 'End') {
                if (focusNode === boundaryNode)
                    return offset === (boundaryNode.nodeValue || '').length;
                boundaryNode = boundaryNode.lastChild;
            }
        }
        return false;
    }
    _checkChangeEvent() {
        clearTimeout(this._checkChangeDelayTask);
        this._checkChangeDelayTask = setTimeout(() => {
            let txt = this.ele.textContent || '';
            if (txt !== this._prevTextContent) {
                this._prevTextContent = txt;
                this.emit('change');
            }
        }, this.config.checkChangeDelay);
    }
}
TextEditor.defaultConfig = {
    multiline: false,
    checkChangeDelay: 500
};
exports.TextEditor = TextEditor;
//# sourceMappingURL=TextEditor.js.map