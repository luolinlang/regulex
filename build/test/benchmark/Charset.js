"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Kit_1 = require("../../src/Kit");
const Unicode_1 = require("../../src/Unicode");
const benchmark_1 = require("benchmark");
const assert = require("assert");
const suite = new benchmark_1.Suite();
let charset = Unicode_1.default.General_Category.Letter;
let regex = new RegExp('^' + Unicode_1.default.General_Category.Letter.toRegex().source + '+$', 'u');
let chars = charset
    .toCodePoints(2000)
    .map(Kit_1.Char.chr)
    .sort(() => {
    if (Math.random() > 0.5)
        return 1 /* GT */;
    return -1 /* LT */;
});
let str = chars.join('');
function randChar() {
    return chars[Kit_1.randInt(0, chars.length - 1)];
}
suite
    .add('Charset', () => {
    for (let c of chars) {
        charset.includeChar(c);
    }
})
    .add('Regex', () => {
    assert(regex.test(str));
})
    .on('cycle', function (event) {
    console.log(String(event.target));
})
    .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})
    .run();
//# sourceMappingURL=Charset.js.map