"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Index Signature */
function IndexSig(a) {
    return a;
}
exports.IndexSig = IndexSig;
function isResultOK(a) {
    return a.error === undefined;
}
exports.isResultOK = isResultOK;
function Err(a) {
    return { error: a };
}
exports.Err = Err;
function OK(a) {
    return { value: a };
}
exports.OK = OK;
function compare(a, b) {
    if (a > b)
        return 1 /* GT */;
    if (a < b)
        return -1 /* LT */;
    return 0 /* EQ */;
}
exports.compare = compare;
function compareArray(a1, a2, cmp = compare) {
    let l1 = a1.length;
    let l2 = a2.length;
    if (!l1 && !l2)
        return 0 /* EQ */;
    for (let i = 0, l = Math.min(l1, l2); i < l; i++) {
        let ord = cmp(a1[i], a2[i]);
        if (ord !== 0 /* EQ */)
            return ord;
    }
    return compare(l1, l2);
}
exports.compareArray = compareArray;
/**
Support custom equals method via Eq<T> interface
*/
function deepEqual(a, b) {
    if (typeof a !== 'object' || a == null) {
        return a === b;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        let l1 = a.length;
        let l2 = b.length;
        if (l1 !== l2)
            return false;
        for (let i = 0; i < l1; i++) {
            if (!deepEqual(a[i], b[i]))
                return false;
        }
    }
    else if (typeof a.equals === 'function') {
        return a.equals(b);
    }
    else {
        for (let k in a) {
            if (!deepEqual(a[k], b[k]))
                return false;
        }
    }
    return true;
}
exports.deepEqual = deepEqual;
exports._inspect_ = Symbol.for('nodejs.util.inspect.custom');
/**
Compare unicode string by their code points
string.fromCodePoint(0x1F437) == "🐷" == "\uD83D\uDC37" == "\u{1F437}"
let c1 = '\uD83D\uDC37';
let c2 = '\uFA16';
assert(compareFullUnicode(c1,c2) === Ordering.GT)
*/
function compareFullUnicode(s1, s2) {
    let a1 = Array.from(s1).map(exports.Char.ord);
    let a2 = Array.from(s2).map(exports.Char.ord);
    return compareArray(a1, a2);
}
exports.compareFullUnicode = compareFullUnicode;
function bsearch(a, x, cmp = compare, startIndex = 0, endIndex = a.length - 1) {
    let result = { found: false, index: -1 };
    let i = startIndex - 1;
    for (let lo = startIndex, hi = endIndex; lo <= hi;) {
        i = lo + ((hi - lo + 1) >> 1);
        let middle = a[i];
        let ord = cmp(x, middle);
        if (ord < 0) {
            // LT
            hi = --i;
        }
        else if (ord > 0) {
            // GT
            lo = i + 1;
        }
        else {
            // EQ
            result.found = true;
            break;
        }
    }
    result.index = i;
    return result;
}
exports.bsearch = bsearch;
/**
Return sorted unique Array.
*/
function sortUnique(a, cmp = compare) {
    let n = a.length;
    if (n <= 1)
        return a;
    a = a.slice().sort(cmp);
    let len = 1;
    for (let i = 1, last = a[0]; i < n; i++) {
        let x = a[i];
        if (x === last || cmp(x, last) === 0 /* EQ */)
            continue;
        last = a[len++] = a[i];
    }
    a.length = len;
    return a;
}
exports.sortUnique = sortUnique;
// chr(0x1F4AA) == "💪"  == "\uD83D\uDCAA"
function chr(n) {
    return String.fromCodePoint(n);
}
function ord(c) {
    return c.codePointAt(0);
}
const CHAR_MAX_CODE_POINT = 0x10ffff;
exports.Char = {
    chr: chr,
    ord: ord,
    pred(c) {
        return chr(ord(c) - 1);
    },
    predSafe(c) {
        let n = ord(c) - 1;
        return chr(n < 0 ? 0 : n);
    },
    succ(c) {
        return chr(ord(c) + 1);
    },
    succSafe(c) {
        let n = ord(c) + 1;
        return chr(n > CHAR_MAX_CODE_POINT ? CHAR_MAX_CODE_POINT : n);
    },
    hexEscape(c) {
        let code = c.charCodeAt(0);
        return '\\x' + code.toString(16).padStart(2, '0');
    },
    unicodeEscape(c) {
        let code = c.charCodeAt(0);
        return '\\u' + code.toString(16).padStart(4, '0');
    },
    codePointEscape(c) {
        let code = c.codePointAt(0);
        return '\\u{' + code.toString(16) + '}';
    },
    /** Ctrl A-Z */
    ctrl(c) {
        return String.fromCharCode(c.charCodeAt(0) % 32);
    },
    // Max unicode code point
    MAX_CODE_POINT: CHAR_MAX_CODE_POINT,
    MIN_CHAR: chr(0),
    MAX_CHAR: chr(CHAR_MAX_CODE_POINT)
};
/** Simple random int i, min <= i <= max. */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.randInt = randInt;
const _hasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwn(o, k) {
    return _hasOwnProperty.call(o, k);
}
let _guidCount = 0;
/**
@deprecated Prefer WeakSet or WeakMap
*/
function guidOf(obj) {
    if (hasOwn(obj, '_GUID_')) {
        return obj._GUID_;
    }
    else {
        let _guid = guid();
        // Prohibit from enumerating
        Object.defineProperty(obj, '_GUID_', { value: _guid });
        return _guid;
    }
}
exports.guidOf = guidOf;
/**Alternative to Symbol()*/
function guid() {
    _guidCount = (_guidCount + 1) | 0;
    return '_' + (+new Date()).toString(36).slice(2) + _guidCount.toString(36);
}
exports.guid = guid;
function flat(a) {
    return [].concat(...a);
}
exports.flat = flat;
function escapeUnicodes(s, codePointSyntax = true) {
    let chars = codePointSyntax ? Array.from(s) : s.split('');
    return chars
        .map(c => {
        let cp = ord(c);
        let cps = cp.toString(16).toUpperCase();
        if (cp <= 0xff) {
            return c;
        }
        else if (cp > 0xffff) {
            return '\\u{' + cps + '}';
        }
        else {
            return '\\u' + cps.padStart(4, '0');
        }
    })
        .join('');
}
exports.escapeUnicodes = escapeUnicodes;
function escapeNonAlphanum(s, codePointSyntax = true) {
    let alphanum = /^[A-Z0-9\-\\]$/i;
    let chars = codePointSyntax ? Array.from(s) : s.split('');
    return chars
        .map(c => {
        let cp = ord(c);
        let cps = cp.toString(16).toUpperCase();
        if (alphanum.test(c)) {
            return c;
        }
        else if (cp <= 0xf) {
            return '\\x0' + cps;
        }
        else if (cp <= 0xff) {
            return '\\x' + cps;
        }
        else if (cp <= 0xfff) {
            return '\\u0' + cps;
        }
        else if (cp > 0xffff) {
            return '\\u{' + cps + '}';
        }
        else {
            return '\\u' + cps;
        }
    })
        .join('');
}
exports.escapeNonAlphanum = escapeNonAlphanum;
function escapeRegex(s, inCharClass = false) {
    s = s.replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (inCharClass) {
        s = s.replace(/-/g, '\\-');
    }
    return s;
}
exports.escapeRegex = escapeRegex;
function sum(nums) {
    let total = 0;
    for (let n of nums) {
        total += n;
    }
    return total;
}
exports.sum = sum;
function enumNum(begin, end) {
    let a = [];
    while (begin <= end) {
        a.push(begin++);
    }
    return a;
}
exports.enumNum = enumNum;
function invertMap(m) {
    return new Map(Array.from(m).map(kv => kv.reverse()));
}
exports.invertMap = invertMap;
function invertRecord(m) {
    let a = {};
    for (let k in m) {
        a[m[k]] = k;
    }
    return a;
}
exports.invertRecord = invertRecord;
const _excludeSignCodePoint = 94; //ord('^');
const _hyphenCodePoint = 45; // ord('-');
const _escapeCodePoint = 92; // ord('\\');
/** Math.pow(2,21). */
const B2_21 = 0x200000;
/** Math.pow(2,21) - 1. Bits Char.MAX_CODE_POINT used.  */
const B2_21_1 = 0x1fffff;
var CharRange;
(function (CharRange) {
    /** Pack char range two chars to CharRangeRepr */
    function fromCharPair(beginChar, endChar) {
        return pack(ord(beginChar), ord(endChar));
    }
    CharRange.fromCharPair = fromCharPair;
    /** Pack single char to CharRangeRepr */
    function singleChar(c) {
        return single(ord(c));
    }
    CharRange.singleChar = singleChar;
    /** Pack single char code point to CharRangeRepr */
    function single(codePoint) {
        return pack(codePoint, codePoint);
    }
    CharRange.single = single;
    /** Pack char range two code points into number CharRangeRepr */
    function pack(begin, end) {
        return (begin * B2_21 + end);
    }
    CharRange.pack = pack;
    function begin(r) {
        return (r / B2_21) & B2_21_1;
    }
    CharRange.begin = begin;
    function end(r) {
        return r & B2_21_1;
    }
    CharRange.end = end;
    function getSize(r) {
        return end(r) - begin(r) + 1;
    }
    CharRange.getSize = getSize;
    function includeChar(range, c) {
        let cp = ord(c);
        return includeCodePoint(range, cp);
    }
    CharRange.includeChar = includeChar;
    function includeCodePoint(range, cp) {
        return begin(range) <= cp && cp <= end(range);
    }
    CharRange.includeCodePoint = includeCodePoint;
    function isSubsetOf(a, b) {
        return begin(b) <= begin(a) && end(a) <= end(b);
    }
    CharRange.isSubsetOf = isSubsetOf;
    function isSingle(r) {
        return begin(r) === end(r);
    }
    CharRange.isSingle = isSingle;
    function intersect(a, b) {
        let a1 = begin(a);
        let a2 = end(a);
        let b1 = begin(b);
        let b2 = end(b);
        if (b2 < a1 || a2 < b1)
            return;
        if (a1 <= b1) {
            if (b2 <= a2)
                return b;
            else
                return pack(b1, a2);
        }
        else {
            if (a2 <= b2)
                return a;
            else
                return pack(a1, b2);
        }
    }
    CharRange.intersect = intersect;
    function join(a, b) {
        let a1 = begin(a);
        let a2 = end(a);
        let b1 = begin(b);
        let b2 = end(b);
        if (b2 + 1 < a1 || a2 + 1 < b1)
            return;
        return pack(Math.min(a1, b1), Math.max(a2, b2));
    }
    CharRange.join = join;
    /**
    Subtract range:
    a - b === a, if a and b have no overlap
    a - b === undefined, if a isSubsetof b
    a - b === range, if a starts with b or a ends with b
    a - b === [r1,r2], if b isSubsetof a and a.begin < b.begin && b.end < a.end
    */
    function subtract(a, b) {
        let a1 = begin(a);
        let a2 = end(a);
        let b1 = begin(b);
        let b2 = end(b);
        if (b2 < a1 || a2 < b1)
            return a;
        let left = a1 < b1;
        let right = b2 < a2;
        if (left && right)
            return [pack(a1, b1 - 1), pack(b2 + 1, a2)];
        if (left)
            return pack(a1, b1 - 1);
        if (right)
            return pack(b2 + 1, a2);
        // if (!left && !right)  return;
    }
    CharRange.subtract = subtract;
    /**
    Coalesce char range list to non-overlapping sorted ranges.
    */
    function coalesce(ranges) {
        let newRanges = [];
        ranges = sortUnique(ranges, CharRange.compare);
        if (ranges.length <= 1)
            return ranges;
        let prev = ranges[0];
        for (let i = 1, l = ranges.length; i < l; i++) {
            let a = ranges[i];
            let joined = join(a, prev);
            if (typeof joined === 'undefined') {
                newRanges.push(prev);
                prev = a;
            }
            else {
                prev = joined;
            }
        }
        newRanges.push(prev);
        return newRanges;
    }
    CharRange.coalesce = coalesce;
    function compare(a, b) {
        if (a === b)
            return 0 /* EQ */;
        if (a < b)
            return -1 /* LT */;
        else
            return 1 /* GT */;
    }
    CharRange.compare = compare;
    function compareIn(x, r) {
        if (isSubsetOf(x, r))
            return 0 /* EQ */;
        if (x < r)
            return -1 /* LT */;
        else
            return 1 /* GT */;
    }
    CharRange.compareIn = compareIn;
    /**
    If char is less than range low bound, return LT, if char is in range, return EQ, and so forth.
    */
    function compareCharToRange(c, range) {
        return compareCodePointToRange(ord(c), range);
    }
    CharRange.compareCharToRange = compareCharToRange;
    function compareCodePointToRange(cp, range) {
        let r1 = begin(range);
        let r2 = end(range);
        if (cp < r1)
            return -1 /* LT */;
        if (cp > r2)
            return 1 /* GT */;
        return 0 /* EQ */;
    }
    CharRange.compareCodePointToRange = compareCodePointToRange;
    /**
    Convert CharRange to regex char class like pattern string
    @see `Charset.fromPattern`
    */
    function toPattern(range) {
        let r1 = begin(range);
        let r2 = end(range);
        if (r1 === r2)
            return toChar(r1);
        if (r1 + 1 === r2)
            return toChar(r1) + toChar(r2);
        return toChar(r1) + '-' + toChar(r2);
        function toChar(cp) {
            if (cp === _escapeCodePoint || cp === _excludeSignCodePoint || cp === _hyphenCodePoint) {
                return '\\' + chr(cp);
            }
            else {
                return chr(cp);
            }
        }
    }
    CharRange.toPattern = toPattern;
    function toCodePoints(range, maxCount = Infinity) {
        let r1 = begin(range);
        let r2 = end(range);
        let a = [];
        while (r1 <= r2 && a.length < maxCount) {
            a.push(r1++);
        }
        return a;
    }
    CharRange.toCodePoints = toCodePoints;
})(CharRange = exports.CharRange || (exports.CharRange = {}));
/**
Regex like Charset,support ranges and invertion
@example Charset.fromPattern("^a-z0-9")
*/
class Charset {
    /**
    Create from CharRange list.
    */
    constructor(ranges) {
        this.ranges = CharRange.coalesce(ranges);
    }
    /**
    Regex like char class pattern string like '^a-f123' to Charset: exclude range "a" to "f" and chars "123".
    Support "^" to indicate invertion. Char "\" only used to escape "-" and "\" itself.
    Char classes like "\w\s" are not supported!
    @param {string} re  Regex like char class [^a-z0-9_] input as "^a-z0-9_".
    */
    static fromPattern(re) {
        if (!re.length)
            return Charset.empty;
        let codePoints = Array.from(re).map(ord);
        let stack = [];
        let ranges = [];
        let exclude = false;
        let i = 0;
        if (codePoints[0] === _excludeSignCodePoint && codePoints.length > 1) {
            i++;
            exclude = true;
        }
        for (let l = codePoints.length; i < l; i++) {
            let cp = codePoints[i];
            if (cp === _escapeCodePoint) {
                // Identity escape,e.g. "-" and "="
                if (++i < l) {
                    stack.push(codePoints[i]);
                }
                else {
                    throw new SyntaxError('Invalid end escape');
                }
            }
            else if (cp === _hyphenCodePoint) {
                i++;
                if (stack.length > 0 && i < l) {
                    let rangeBegin = stack.pop();
                    let rangeEnd = codePoints[i];
                    if (rangeEnd === _escapeCodePoint) {
                        if (++i < l) {
                            rangeEnd = codePoints[i];
                        }
                        else {
                            throw new SyntaxError('Invalid end escape');
                        }
                    }
                    if (rangeBegin > rangeEnd) {
                        // z-a  is invalid
                        throw new RangeError('Charset range out of order: ' +
                            escapeNonAlphanum(String.fromCodePoint(rangeBegin, _hyphenCodePoint, rangeEnd)) +
                            ' !\n' +
                            escapeNonAlphanum(re));
                    }
                    ranges.push(CharRange.pack(rangeBegin, rangeEnd));
                }
                else {
                    throw new SyntaxError('Incomplete char range at ' + i + ': ' + String.fromCodePoint(...codePoints.slice(i - 2, i + 2)));
                }
            }
            else {
                stack.push(cp);
            }
        }
        ranges = ranges.concat(stack.map(CharRange.single));
        let charset = new Charset(ranges);
        if (exclude) {
            return Charset.unicode.subtract(charset);
        }
        else {
            return charset;
        }
    }
    /**
    Build from single char list.
    */
    static fromChars(chars) {
        return Charset.fromCodePoints(Array.from(chars).map(ord));
    }
    static fromCodePoints(codePoints) {
        return new Charset(codePoints.map(CharRange.single));
    }
    includeChar(c) {
        return this.includeCodePoint(ord(c));
    }
    includeCodePoint(cp) {
        let { found } = bsearch(this.ranges, cp, (cp, range) => {
            return CharRange.compareCodePointToRange(cp, range);
        });
        return found;
    }
    includeRange(range) {
        let { found } = bsearch(this.ranges, range, (range, x) => {
            if (CharRange.isSubsetOf(range, x))
                return 0 /* EQ */;
            return CharRange.compare(range, x);
        });
        return found;
    }
    isSubsetof(parent) {
        let a = this.intersect(parent);
        return a.equals(this);
    }
    isEmpty() {
        return !this.ranges.length;
    }
    /**
    Get Charset total count of chars
    */
    getSize() {
        if (this._size === undefined) {
            this._size = sum(this.ranges.map(CharRange.getSize));
        }
        return this._size;
    }
    getMinCodePoint() {
        if (!this.ranges.length)
            return;
        return CharRange.begin(this.ranges[0]);
    }
    getMaxCodePoint() {
        if (!this.ranges.length)
            return;
        return CharRange.end(this.ranges[this.ranges.length - 1]);
    }
    subtract(other) {
        let newRanges = [];
        let thisRanges = this.ranges.slice();
        let toExcludeRanges = other.ranges;
        let i = 0;
        loopNextExclude: for (let ex of toExcludeRanges) {
            for (; i < thisRanges.length; i++) {
                let range = thisRanges[i];
                let rg = CharRange.subtract(range, ex);
                if (rg === range) {
                    // no overlap
                    if (range > ex) {
                        continue loopNextExclude;
                    }
                    else {
                        newRanges.push(range);
                        continue;
                    }
                }
                else if (typeof rg === 'undefined') {
                    // whole a has been excluded
                    continue;
                }
                else if (Array.isArray(rg)) {
                    newRanges.push(rg[0]);
                    thisRanges[i] = rg[1];
                    continue loopNextExclude;
                }
                else {
                    if (rg < ex) {
                        newRanges.push(rg);
                        continue;
                    }
                    else {
                        thisRanges[i] = rg;
                        continue loopNextExclude;
                    }
                }
            }
            break;
        }
        let ranges = newRanges.concat(thisRanges.slice(i));
        if (!ranges.length)
            return Charset.empty;
        return new Charset(ranges);
    }
    inverted() {
        return Charset.unicode.subtract(this);
    }
    union(other) {
        return new Charset(this.ranges.concat(other.ranges));
    }
    intersect(other) {
        let otherRanges = other.ranges.slice();
        let thisRanges = this.ranges;
        let newRanges = [];
        for (let i = 0, j = 0; i < thisRanges.length && j < otherRanges.length;) {
            let r1 = thisRanges[i];
            let r2 = otherRanges[j];
            let inter = CharRange.intersect(r1, r2);
            if (typeof inter === 'undefined') {
                // no overlap
                if (r1 < r2)
                    i++;
                else
                    j++;
            }
            else {
                newRanges.push(inter);
                let end1 = CharRange.end(r1);
                let end2 = CharRange.end(r2);
                if (end1 <= end2)
                    i++;
                if (end2 <= end1)
                    j++;
            }
        }
        if (!newRanges.length)
            return Charset.empty;
        return new Charset(newRanges);
    }
    equals(other) {
        if (this.ranges.length !== other.ranges.length)
            return false;
        return compareArray(this.ranges, other.ranges, CharRange.compare) === 0 /* EQ */;
    }
    toPattern() {
        return this.ranges.map(CharRange.toPattern).join('');
    }
    toString() {
        return escapeNonAlphanum(this.toPattern());
    }
    toRegex() {
        return new RegExp('[' + this.toPattern().replace(/[\[\]]/g, '\\$&') + ']', 'u');
    }
    toCodePoints(maxCount = Infinity) {
        let a = [];
        for (let r of this.ranges) {
            let b = CharRange.toCodePoints(r, maxCount);
            maxCount -= b.length;
            a.push(b);
        }
        return flat(a);
    }
    [exports._inspect_]() {
        return this.toString();
    }
    static compare(a, b) {
        if (a === b)
            return 0 /* EQ */;
        return compareArray(a.ranges, b.ranges, CharRange.compare);
    }
    static union(a) {
        return a.reduce((prev, current) => prev.union(current), Charset.empty);
    }
}
Charset.unicode = new Charset([CharRange.pack(0, exports.Char.MAX_CODE_POINT)]);
Charset.empty = new Charset([]);
exports.Charset = Charset;
//# sourceMappingURL=Kit.js.map