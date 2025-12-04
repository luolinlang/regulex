"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UnicodeProperty = require("../UnicodeProperty");
const fs = require("fs");
const Kit_1 = require("../Kit");
exports.DEFAULT_UNICODE_PKG = 'unicode-12.0.0';
if (require.main === module) {
    console.log('Build: src/Unicode.ts');
    buildUnicode(fs.realpathSync(__dirname) + '/../Unicode.ts');
}
function buildUnicode(outputFile, unicodePkg = exports.DEFAULT_UNICODE_PKG) {
    let table = {};
    let unicodeProps = {
        Binary_Property: UnicodeProperty.canonical.Binary_Property,
        General_Category: UnicodeProperty.canonical.General_Category,
        Script: UnicodeProperty.canonical.Script,
        Script_Extensions: UnicodeProperty.canonical.Script_Extensions
    };
    for (let cls in unicodeProps) {
        table[cls] = {};
        for (let cat of unicodeProps[cls]) {
            let charset = readCharset(cls, cat);
            table[cls][cat] = charset.toPattern();
        }
    }
    let scriptCommon = {};
    for (let k of unicodeProps.Script) {
        if (table.Script[k] === table.Script_Extensions[k]) {
            scriptCommon[k] = table.Script[k];
            delete table.Script[k];
            delete table.Script_Extensions[k];
        }
    }
    // Zip is enough, but I want to share the same Charset object in runtime
    let scriptCommonCode = serialize(scriptCommon);
    let scriptCode = serialize(table.Script);
    delete table.Script;
    let scriptExtensionsCode = serialize(table.Script_Extensions);
    delete table.Script_Extensions;
    let unicodeDefCode = serialize(table);
    let code = `
import {Charset} from './Kit';
const P = Charset.fromPattern;

const ScriptCommon = ${scriptCommonCode};

export default Object.assign(${unicodeDefCode},{
  Script:Object.assign(${scriptCode},ScriptCommon),
  Script_Extensions:Object.assign(${scriptExtensionsCode},ScriptCommon),
});

`;
    fs.writeFileSync(outputFile, code);
    function serialize(a) {
        let codes = [];
        let t = typeof a;
        if (t === 'object') {
            for (let k in a) {
                codes.push(k + ':' + serialize(a[k]));
            }
            return '{' + codes.join(',') + '}';
        }
        else {
            return 'P(' + escapeUnsafeUnicode(JSON.stringify(a)) + ')';
        }
    }
    function readCharset(cls, cat) {
        let codePoints = require(unicodePkg + '/' + cls + '/' + cat + '/code-points.js');
        return Kit_1.Charset.fromCodePoints(codePoints);
    }
}
exports.buildUnicode = buildUnicode;
/**
ES5 and JSON allow <LS> '\u2028' and <PS> '\u2029' in string,but TypeScript and strict ES not.
Isolated surrogates (\uD800-\uDBFF and \uDC00-\uDFFF) have undefined behaviours,such as all becomes "\uFFFD".
*/
function escapeUnsafeUnicode(s) {
    const unsafeUnicode = /^[\u2028\u2029\uD800-\uDBFF\uDC00-\uDFFF]$/;
    return Array.from(s)
        .map(c => {
        if (unsafeUnicode.test(c)) {
            return ('\\u' +
                c
                    .codePointAt(0)
                    .toString(16)
                    .toUpperCase());
        }
        return c;
    })
        .join('');
}
exports.escapeUnsafeUnicode = escapeUnsafeUnicode;
/**
Split charset list into non-overlapping charset.
@return Non-overlapping factors and mapping each charset to its sub parts.
        If a charset has not been decomposed then it will not present in mapping

@deprecated  Zip compression is enough.
*/
function factorize(charsets) {
    let queue = charsets.filter(c => !c.isEmpty()).sort(Kit_1.Charset.compare);
    let tempMap = new Map();
    let factors = [];
    let result = { factors, mapping: tempMap };
    if (queue.length < 2) {
        result.factors = queue;
        return result;
    }
    outerLoop: for (let i = 0; i < queue.length; i++) {
        let a = queue[i];
        let endA = Kit_1.CharRange.end(a.ranges[a.ranges.length - 1]);
        for (let j = i + 1; j < queue.length; j++) {
            let b = queue[j];
            let beginB = Kit_1.CharRange.begin(b.ranges[0]);
            if (endA < beginB) {
                break;
            }
            let inter = a.intersect(b);
            if (inter.isEmpty()) {
                continue;
            }
            else if (a.equals(b)) {
                if (a !== b) {
                    tempMap.set(a, [b]);
                }
                continue outerLoop;
            }
            else {
                let remainA = a.subtract(inter);
                let remainB = b.subtract(inter);
                if (remainA.isEmpty()) {
                    inter = a;
                }
                if (remainB.isEmpty()) {
                    inter = b;
                }
                if (b !== inter) {
                    queue.splice(j, 1);
                    let found = sink(remainB, j);
                    if (found) {
                        remainB = found;
                    }
                    tempMap.set(b, [inter, remainB]);
                    j--;
                }
                if (a !== inter && b !== inter) {
                    sink(inter, i + 1);
                }
                if (a !== inter) {
                    let found = sink(remainA, i + 1);
                    if (found) {
                        remainA = found;
                    }
                    tempMap.set(a, [inter, remainA]);
                    continue outerLoop;
                }
            }
        }
        factors.push(a);
    }
    result.mapping = new Map();
    let m = result.mapping;
    for (let c of charsets) {
        let a = findParts(c);
        if (a) {
            m.set(c, a);
        }
    }
    return result;
    function findParts(charset) {
        let parts = tempMap.get(charset);
        if (!parts) {
            return;
        }
        let a = Kit_1.flat(parts.map(c => findParts(c) || [c]));
        tempMap.set(charset, a);
        return a;
    }
    function sink(c, startIndex) {
        // insert charset back to queue and keep order
        let { found, index } = Kit_1.bsearch(queue, c, Kit_1.Charset.compare, startIndex);
        if (found) {
            // Found charset equal to current insert
            return queue[index];
        }
        else {
            // TODO: HeapQueue ?
            queue.splice(index + 1, 0, c);
        }
    }
}
exports.factorize = factorize;
//# sourceMappingURL=buildUnicode.js.map