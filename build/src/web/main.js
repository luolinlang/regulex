"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RegexEditor_1 = require("./RegexEditor");
require("./style/main.css"); // Webpack sucks!
document.addEventListener('DOMContentLoaded', main);
function main() {
    let editor = new RegexEditor_1.RegexEditor();
    let editorCt = byId('editorCt');
    editor.renderTo(editorCt);
    let visualizeBtn = byId('visualizeBtn');
    visualizeBtn.onclick = () => {
        console.log(editor.getRegex());
    };
}
function byId(id) {
    return document.getElementById(id);
}
//# sourceMappingURL=main.js.map