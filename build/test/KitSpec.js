"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const K = require("../src/Kit");
const C = require("fast-check");
const utils_1 = require("./utils");
const chai_1 = require("chai");
const Unicode_1 = require("../src/Unicode");
const UnicodeProperty = require("../src/UnicodeProperty");
const buildUnicode_1 = require("../src/tools/buildUnicode");
const charPairGen = () => C.tuple(C.fullUnicode(), C.fullUnicode());
const charRangeGen = () => charPairGen().map(a => {
    a.sort(K.compareFullUnicode);
    return K.CharRange.fromCharPair(a[0], a[1]);
});
const listOfCharRange = (max = 40) => C.array(charRangeGen(), 1, max);
describe('Kit', () => {
    describe('bsearch', () => {
        utils_1.testProp('should be found', C.array(C.integer()), a => {
            a = a.sort(K.compare);
            for (let i = 0; i < a.length; i++) {
                let { found, index } = K.bsearch(a, a[i]);
                chai_1.assert(found && a[index] === a[i]);
            }
        });
        utils_1.testProp('should be not found but stop at right index', C.array(C.integer()), a => {
            if (!a.length) {
                var { found, index } = K.bsearch(a, 12345);
                chai_1.assert(!found && index === -1);
                return;
            }
            a = a.sort(K.compare);
            var { found, index } = K.bsearch(a, a[0] - 1);
            chai_1.assert(!found && index === -1);
            var { found, index } = K.bsearch(a, a[a.length - 1] + 1);
            chai_1.assert(!found && index === a.length - 1);
            for (let i = 0; i < a.length - 1; i++) {
                if (a[i] === a[i + 1])
                    continue;
                // let x = generate a number not in array
                let x = (a[i] + a[i + 1]) / 2;
                // a[i] < x < a[i+1]
                // So it should not be found but stop at i
                var { found, index } = K.bsearch(a, x);
                chai_1.assert(!found && index === i);
            }
        });
    });
    describe('sortUnique', () => {
        utils_1.testProp('should return distinct', C.array(C.integer()), a => {
            let b = K.sortUnique(a);
            let n = new Set(a).size;
            chai_1.assert(b.length === n);
            for (let i = 0; i < a.length; i++) {
                chai_1.assert(K.bsearch(b, a[i]).found);
            }
        });
    });
    describe('CharRange', () => {
        it('compareFullUnicode', () => {
            // String.fromCodePoint(0x1F437) == "🐷" == "\uD83D\uDC37" == "\u{1F437}"
            let c1 = '\uD83D\uDC37';
            let c2 = '\uFA16';
            chai_1.assert(K.compareFullUnicode(c1, c2) > 0);
        });
        utils_1.testProp('subtract join intersect', C.tuple(charRangeGen(), charRangeGen()), a => {
            let [r1, r2] = a;
            chai_1.assert(K.CharRange.subtract(r1, r1) === undefined);
            chai_1.assert(K.CharRange.join(r1, r1) === r1);
            let inter = K.CharRange.intersect(r1, r2);
            if (inter === undefined) {
                chai_1.assert(K.CharRange.subtract(r1, r2) === r1);
                chai_1.assert(K.CharRange.subtract(r2, r1) === r2);
            }
            else {
                let join = K.CharRange.join(r1, r2);
                if (join === undefined)
                    return chai_1.assert(join !== undefined);
                let j1 = K.CharRange.subtract(join, r1);
                if (j1 === undefined)
                    return chai_1.assert(join === r1 && K.CharRange.isSubsetOf(r2, r1));
                let j2 = K.CharRange.subtract(join, r2);
                if (j2 === undefined)
                    return chai_1.assert(join === r2 && K.CharRange.isSubsetOf(r1, r2));
                if (Array.isArray(j1)) {
                    chai_1.assert(inter === r1);
                }
                else if (Array.isArray(j2)) {
                    chai_1.assert(inter === r2);
                }
                else {
                    chai_1.assert(K.CharRange.join(j1, inter) === r2);
                    chai_1.assert(K.CharRange.join(j2, inter) === r1);
                }
            }
        });
        utils_1.testProp('should include after coalesce', listOfCharRange(), a => {
            let ranges = K.CharRange.coalesce(a);
            for (let r of a) {
                let { found, index } = K.bsearch(ranges, r, K.CharRange.compareIn);
                chai_1.assert(found && K.CharRange.isSubsetOf(r, ranges[index]));
            }
        });
    });
    describe('Charset', function () {
        this.timeout(60000);
        utils_1.testProp('fromPattern toPattern equal', listOfCharRange(), a => {
            let charset = new K.Charset(a);
            chai_1.assert(K.Charset.fromPattern(charset.toPattern()).equals(charset));
        });
        utils_1.testProp('should include/exclude chars', C.tuple(listOfCharRange(10), C.boolean()), ([a, toExclude]) => {
            let charset = new K.Charset(a);
            if (toExclude) {
                charset = K.Charset.fromPattern('^' + charset.toPattern());
            }
            for (let range of a) {
                for (let c of utils_1.sampleInCharRange(range)) {
                    chai_1.assert(charset.includeChar(c) !== toExclude);
                }
            }
        });
        utils_1.testProp('union intersect subtract', C.tuple(listOfCharRange(), listOfCharRange()), ([ranges1, ranges2]) => {
            let charset1 = new K.Charset(ranges1);
            let charset2 = new K.Charset(ranges2);
            chai_1.assert(charset1.union(charset1).equals(charset1));
            let union = charset1.union(charset2);
            chai_1.assert(charset1.isSubsetof(union));
            chai_1.assert(charset2.isSubsetof(union));
            let inter = charset1.intersect(charset1);
            chai_1.assert(inter && inter.equals(charset1));
            inter = charset1.intersect(charset2);
            if (inter.isEmpty()) {
                chai_1.assert(union.subtract(charset1).equals(charset2));
                chai_1.assert(union.subtract(charset2).equals(charset1));
            }
            else {
                chai_1.assert(union
                    .subtract(charset1)
                    .union(inter)
                    .equals(charset2));
                chai_1.assert(union
                    .subtract(charset2)
                    .union(inter)
                    .equals(charset1));
            }
        });
        utils_1.testProp('inverted complementary', listOfCharRange(), a => {
            let include = new K.Charset(a);
            let exclude = K.Charset.fromPattern('^' + include.toPattern());
            chai_1.assert(include.inverted().toPattern() === exclude.toPattern());
            chai_1.assert.deepEqual(include.inverted().ranges, exclude.ranges);
            chai_1.assert(include.inverted().equals(exclude));
            chai_1.assert(exclude.inverted().equals(include));
            let charset1 = include.union(exclude);
            chai_1.assert(charset1.equals(K.Charset.unicode));
            let charset2 = K.Charset.unicode.subtract(exclude);
            chai_1.assert(charset2.equals(include));
            chai_1.assert(include.intersect(exclude).isEmpty());
        });
        // Impractical, took several seconds or even minutes to complete these tests
        if (false) {
            let unicodeCats = (function () {
                let a = [];
                let U = Object.assign({}, UnicodeProperty.canonical);
                delete U.NonBinary_Property;
                for (let k in U) {
                    for (let cat of U[k]) {
                        a.push(k + '/' + cat);
                    }
                }
                return a;
            })();
            const genUnicodeCat = C.constantFrom(...unicodeCats);
            it('Unicode module', () => {
                for (let path of unicodeCats) {
                    let codePoints = require(buildUnicode_1.DEFAULT_UNICODE_PKG + '/' + path + '/code-points.js');
                    let charset = K.Charset.fromCodePoints(codePoints);
                    let [cls, cat] = path.split('/');
                    chai_1.assert(charset.equals(Unicode_1.default[cls][cat]));
                }
            });
            utils_1.testProp('Unicode category fromPattern toPattern equal', genUnicodeCat, cat => {
                let codePoints = require(buildUnicode_1.DEFAULT_UNICODE_PKG + '/' + cat + '/code-points.js');
                let charset = K.Charset.fromCodePoints(codePoints);
                chai_1.assert(K.Charset.fromPattern(charset.toPattern()).equals(charset));
            });
            utils_1.testProp('fromCodePoints toCodePoints equal', genUnicodeCat, cat => {
                let codePoints = require(buildUnicode_1.DEFAULT_UNICODE_PKG + '/' + cat + '/code-points.js');
                let charset = K.Charset.fromCodePoints(codePoints);
                chai_1.assert.deepEqual(charset.toCodePoints(), codePoints);
            });
            utils_1.testProp('factorize', C.array(listOfCharRange(), 1, 60), a => {
                let charsets = a.map(ranges => new K.Charset(ranges));
                let { factors, mapping } = buildUnicode_1.factorize(charsets);
                if (factors.length) {
                    assertNonOverlap(factors);
                }
                else {
                    for (let c of charsets) {
                        chai_1.assert(!mapping.has(c));
                    }
                }
                let factorUnion = K.Charset.union(factors);
                let union = K.Charset.union(charsets);
                chai_1.assert(factorUnion.equals(union));
                let factorSize = K.sum(factors.map(c => c.getSize()));
                let factorUnionSize = factorUnion.getSize();
                let unionSize = union.getSize();
                chai_1.assert(factorSize === unionSize && factorUnionSize === unionSize);
                for (let [c, parts] of mapping) {
                    let u = K.Charset.union(parts);
                    assertNonOverlap(parts);
                    chai_1.assert(c.equals(u));
                }
                for (let c of charsets) {
                    if (!mapping.has(c)) {
                        for (let a of factors) {
                            chai_1.assert(a === c || c.intersect(a).isEmpty());
                        }
                    }
                }
                function assertNonOverlap(a) {
                    a.reduce((prev, current) => {
                        chai_1.assert(prev.intersect(current).isEmpty());
                        return current;
                    });
                }
            });
        }
    });
});
//# sourceMappingURL=KitSpec.js.map