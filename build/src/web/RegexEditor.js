"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HTML_1 = require("./HTML");
const EventEmitter_1 = require("./EventEmitter");
const TextEditor_1 = require("./TextEditor");
const css = require("./style/RegexEditor.local.css");
const AST = require("../AST");
const K = require("../Kit");
const JSRE = require("../grammar/JSRE");
class RegexEditor extends EventEmitter_1.EventEmitter {
    constructor(config) {
        super({
            hooks: {
                change: {
                    init: () => {
                        sourceEditor.on('change', _onChange);
                        this._flagsInput.addEventListener('input', _onChange);
                    },
                    clear: () => {
                        sourceEditor.un('change', _onChange);
                        this._flagsInput.removeEventListener('input', _onChange);
                    }
                }
            }
        });
        this._sourceEditor = new TextEditor_1.TextEditor();
        this._flagsInput = HTML_1.h.input({ className: css.flagsInput, value: 'u', maxLength: 8 });
        this.ele = HTML_1.h.div({ className: css.editorCt }, HTML_1.h.div({ className: css.slash }), this._sourceEditor.ele, HTML_1.h.div({ className: css.endSlash + ' ' + css.slash }), HTML_1.h.div({ className: css.flagsInputCt }, this._flagsInput));
        this.config = Object.assign({}, RegexEditor.defaultConfig, config || {});
        const _onChange = this._onChange.bind(this);
        let sourceEditor = this._sourceEditor;
        sourceEditor.ele.classList.add(css.sourceEditor);
        sourceEditor.setTextContent(this.config.source);
        sourceEditor.ele.addEventListener('paste', event => {
            event.preventDefault();
            let data = event.clipboardData;
            let re = data.getData('text').trim();
            let flagsPattern = /\/([imgsuyx]*)$/u;
            if (re.startsWith('/') && flagsPattern.test(re)) {
                // Paste RegExp literal
                let flags = flagsPattern.exec(re)[1];
                if (flags) {
                    this._flagsInput.value = flags;
                }
                re = re.slice(1, re.lastIndexOf('/'));
                sourceEditor.setTextContent(re);
            }
            else {
                sourceEditor.insertAt(re, 'Caret');
            }
        });
        sourceEditor.on('boundary', event => {
            if (event.boundary === 'End') {
                this._flagsInput.focus();
                this._flagsInput.selectionEnd = 0;
            }
        });
    }
    renderTo(container) {
        container.appendChild(this.ele);
        this._afterRender();
    }
    _afterRender() {
        this._initFlagsInput();
    }
    getRegex() {
        let { source, flags } = this.getRawText();
        let flagsResult = AST.RegexFlags.parse(flags, true);
        if (!K.isResultOK(flagsResult)) {
            return K.Err({ type: 'Flags', invalid: flagsResult.error });
        }
        let regexFlags = flagsResult.value;
        let regexResult = JSRE.parse(source, regexFlags);
        return regexResult;
    }
    getRawText() {
        return {
            source: this._sourceEditor.getTextContent(),
            flags: this._flagsInput.value
        };
    }
    _initFlagsInput() {
        let input = this._flagsInput;
        let maxWidth = parseInt(getComputedStyle(input).maxWidth);
        let charWidth = Math.ceil(maxWidth / input.maxLength);
        resizeInput();
        input.addEventListener('input', resizeInput);
        input.addEventListener('keydown', event => {
            if (event.keyCode === TextEditor_1.LEFT_ARROW_KEYCODE && input.selectionEnd === 0) {
                this._sourceEditor.focus('End');
                event.preventDefault();
            }
        });
        function resizeInput() {
            let w = (input.value.length + 1) * charWidth;
            w = w > maxWidth ? maxWidth : w;
            input.style.width = w + 'px';
        }
    }
    _onChange(event) {
        let resultRegex = this.getRegex();
        let evt = event;
        evt.resultRegex = resultRegex;
        this.emit('change', evt);
    }
}
RegexEditor.defaultConfig = {
    source: '',
    instantValidate: true,
    syntax: 'JSRE'
};
exports.RegexEditor = RegexEditor;
//# sourceMappingURL=RegexEditor.js.map