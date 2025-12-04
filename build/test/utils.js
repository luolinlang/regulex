"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const C = require("fast-check");
const K = require("../src/Kit");
const assert_1 = require("assert");
const PropertyGeneric = require("fast-check/lib/check/property/Property.generic");
function prettyPrint(a, indent = 2) {
    let mem = {};
    let code = JSON.stringify(replace('', a), replace, indent);
    let keys = Object.keys(mem);
    if (keys.length) {
        code = code.replace(new RegExp(keys.map(k => '"' + k + '"').join('|'), 'g'), k => {
            return mem[k.slice(1, -1)];
        });
    }
    return code;
    function replace(k, v) {
        if (v instanceof RegExp || v == null || isNumber(v)) {
            let guid = K.guid();
            mem[guid] = v;
            return guid;
        }
        else if (v[K._inspect_]) {
            return v[K._inspect_]();
        }
        else if (v instanceof Set || v instanceof Map) {
            return Array.from(v);
        }
        else if (!Array.isArray(v) && Object.prototype.toString.call(v) === '[object Object]') {
            return sortKeys(v);
        }
        else {
            return v;
        }
    }
    function sortKeys(a) {
        let keys = Object.keys(a).sort();
        let b = Object.create(null);
        for (let k of keys) {
            b[k] = a[k];
        }
        return b;
    }
}
exports.prettyPrint = prettyPrint;
// FastCheck turns error to string in RunDetails caused mocha can not show object diff
// We use this hack to recover original AssertionError instance.
const FastCheckGlobalErrorMap = new Map();
function errorAsKey(err) {
    return '###' + err + '\n' + err.stack + '\n' + JSON.stringify(err) + '###';
}
const PG = PropertyGeneric;
PG.Property.prototype.run = function (v) {
    this.beforeEachHook();
    try {
        const output = this.predicate(v);
        return output == null || output === true ? null : 'Property failed by returning false';
    }
    catch (err) {
        // handleResult: https://github.com/dubzzz/fast-check/blob/469f52cb6236e658c5d4a3cac4545972227486a8/src/check/runner/RunnerIterator.ts#L38
        // precondition failure considered as success for the first version
        // if (PreconditionFailure.isFailure(err)) return err;
        if (err != null && err.footprint === Symbol.for('fast-check/PreconditionFailure'))
            return err;
        // exception as string in case of real failure
        // if (err instanceof Error && err.stack) return `${err}\n\nStack trace: ${err.stack}`;
        // return `${err}`;
        let k = errorAsKey(err);
        FastCheckGlobalErrorMap.set(k, err);
        return k;
    }
    finally {
        this.afterEachHook();
    }
};
/**
Use cli env to specify seed and path to replay test
  export seedpath='{ seed: 1540961949765, path: "18:1:0" }'
  npm run testit src/DemoSpec.js
*/
function testProp(desc, arb, f) {
    return it(desc, property(arb, f));
}
exports.testProp = testProp;
function property(arb, f) {
    return () => {
        let params = {};
        if (process.env.seedpath) {
            params = JSON.parse(process.env.seedpath.replace(/seed|path/g, '"$&"'));
            params.endOnFailure = true;
        }
        let prop = C.property(arb, f);
        const out = C.check(prop, params);
        if (out instanceof Promise) {
            return out.then(_throwIfFailed);
        }
        else {
            _throwIfFailed(out);
        }
    };
}
exports.property = property;
function _throwIfFailed(out) {
    if (out.failed) {
        let e;
        if (out.counterexample == null) {
            e = new assert_1.AssertionError({
                message: `Failed to run property, too many pre-condition failures encountered\n\nRan ${out.numRuns} time(s)\nSkipped ${out.numSkips} time(s)\n\nHint (1): Try to reduce the number of rejected values by combining map, flatMap and built-in arbitraries\nHint (2): Increase failure tolerance by setting maxSkipsPerRun to an higher value`
            });
        }
        else {
            let originalError = FastCheckGlobalErrorMap.get(out.error);
            e = new assert_1.AssertionError({
                message: `Property failed after ${out.numRuns} tests\n{ seed: ${out.seed}, path: "${out.counterexamplePath}" }\nShrunk ${out.numShrinks} time(s). Got error: ${originalError}\n${out.failures.length === 0
                    ? 'Hint: Enable verbose mode in order to have the list of all failing values encountered during the run'
                    : `Encountered failures were:\n- ${out.failures.map(a => prettyPrint(a)).join('\n- ')}`}`,
                expected: originalError.expected,
                actual: originalError.actual
            });
            e.stack = originalError.stack;
        }
        throw e;
    }
}
function allEqual(a) {
    for (let i = 1; i < a.length; i++) {
        if (a[i] !== a[0])
            return false;
    }
    return true;
}
exports.allEqual = allEqual;
function sampleInCharRange(range, maxCount = 100) {
    let chars = [];
    let minCodePoint = K.CharRange.begin(range);
    let maxCodePoint = K.CharRange.end(range);
    let flip = true;
    while (maxCount-- > 0 && minCodePoint <= maxCodePoint) {
        let cp = flip ? minCodePoint++ : maxCodePoint--;
        chars.push(String.fromCodePoint(cp));
        flip = !flip;
    }
    return chars;
}
exports.sampleInCharRange = sampleInCharRange;
function sampleInCharset(charset, maxCount = 100) {
    let chars = [];
    let flip = true;
    let ranges = charset.ranges.slice();
    while (maxCount > 0 && ranges.length) {
        let r = flip ? ranges.pop() : ranges.shift();
        flip = !flip;
        let s = sampleInCharRange(r, maxCount);
        maxCount -= s.length;
        chars = chars.concat(s);
    }
    return chars;
}
exports.sampleInCharset = sampleInCharset;
function genInCharset(ch) {
    return C.constantFrom(...ch.ranges).chain(range => C.integer(K.CharRange.begin(range), K.CharRange.end(range)).map(String.fromCodePoint));
}
exports.genInCharset = genInCharset;
function isNumber(n) {
    return Object.prototype.toString.call(n) === '[object Number]';
}
//# sourceMappingURL=utils.js.map