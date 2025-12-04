"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const K = require("./Kit");
const Kit_1 = require("./Kit");
class ParseCtx {
    constructor(input, state) {
        this.input = input;
        this.state = state;
        this.position = 0;
        // A shared and mutable range field.
        // So we can directly convert ParseCtx to TokenCtx and avoid temp object;
        this.range = [0, 0];
        this.recurMemo = new Map();
    }
}
class Parser {
    /**
    Map result value. Changing state in the map function is allowed, ensure yourself the parser is unrecoverable.
    (Why that? Because we don't have *REAL* immutable data type.)
    */
    map(f) {
        return MapF.compose(this, (r, ctx) => {
            if (Kit_1.isResultOK(r)) {
                return { value: f(r.value, ctx) };
            }
            else {
                return r;
            }
        });
    }
    /**
    Map result function return with UserError
    */
    mapE(f) {
        let p = MapF.compose(this, (r, ctx) => {
            if (Kit_1.isResultOK(r)) {
                let r2 = f(r.value, ctx);
                if (Kit_1.isResultOK(r2)) {
                    return r2;
                }
                else {
                    return {
                        error: {
                            position: ctx.range[0],
                            parser: p,
                            userError: r2.error
                        }
                    };
                }
            }
            else {
                return r;
            }
        });
        return p;
    }
    mapF(f) {
        return MapF.compose(this, f);
    }
    /**
    Map result UserError
    */
    mapError(f) {
        return MapF.compose(this, r => {
            if (Kit_1.isResultOK(r))
                return r;
            if (r.error.userError) {
                r.error.userError = f(r.error.userError);
            }
            return r;
        });
    }
    /**
    We had allowed changing state in map function. But this is required by recoverable parsers in alternative branches
    */
    stateF(f) {
        return new StateF(this, f);
    }
    slice() {
        return this.map((_, ctx) => ctx.input.slice(ctx.range[0], ctx.range[1]));
    }
    opt() {
        return new Optional(this);
    }
    trys() {
        return new TryParser(this);
    }
    followedBy(look) {
        return new Lookahead(this, look, false);
    }
    notFollowedBy(look) {
        return new Lookahead(this, look, true);
    }
    /** Right biased sequence */
    thenR(next) {
        return new Seqs([this, next]).at(1);
    }
    /** Left biased sequence */
    thenL(next) {
        return new Seqs([this, next]).at(0);
    }
    and(next) {
        return new Seqs([this, next]);
    }
    between(left, right) {
        return new Seqs([left, this, right]).at(1);
    }
    repeat(min = 0, max = Infinity) {
        return new Repeat(this, min, max);
    }
    count(n) {
        return this.repeat(n, n);
    }
    many() {
        return this.repeat();
    }
    some() {
        return this.repeat(1);
    }
    betweens(left, right) {
        return new Seqs([new Exact(left), this, new Exact(right)]).at(1);
    }
    /**
    Restricted monad bind, function f can not return Ref reference to other parsers
    */
    thenF(f) {
        return new ThenF(this, f);
    }
    parse(s, initalState) {
        let context = new ParseCtx(s, initalState);
        let result = this._parseWith(context);
        result.state = context.state;
        result.consumed = context.position;
        return result;
    }
    isNullable() {
        if (typeof this._nullable === 'boolean')
            return this._nullable;
        // Default true to prevent left recursion.
        Object.defineProperty(this, '_nullable', { value: true, writable: true });
        return (this._nullable = this._checkNullable());
    }
    _checkNullable() {
        return false;
    }
    // Get Ref parser dereferenced
    _getDeref() {
        if (this._dereferenced) {
            return this;
        }
        else {
            // To hide trivial private properties from debug inspector
            // Default true to prevent recursion
            Object.defineProperty(this, '_dereferenced', { value: true, writable: true });
            return this._deref();
        }
    }
    _deref() {
        return this;
    }
    /**
    Get NonNullable left first set
    */
    _getFirstSet() {
        return [this];
    }
    // Description
    desc() {
        return this.constructor.name;
    }
    [K._inspect_]() {
        return this.desc();
    }
}
exports.Parser = Parser;
class FParser extends Parser {
    constructor(_f) {
        super();
        this._f = _f;
    }
    _parseWith(context) {
        let result = this._f(context);
        if (result.error) {
            let errorResult = {
                error: {
                    position: context.position,
                    parser: this
                }
            };
            if (typeof result.error === 'string') {
                errorResult.error.message = result.error;
            }
            else if (result.error !== true) {
                errorResult.error.userError = result.error;
            }
            return errorResult;
        }
        else {
            context.position += result.consumed;
            return { value: result.value };
        }
    }
}
exports.FParser = FParser;
class MapF extends Parser {
    constructor(_p, _f) {
        super();
        this._p = _p;
        this._f = _f;
    }
    static compose(p, f) {
        if (p instanceof MapF) {
            let g = p._f;
            return new MapF(p._p, (v, ctx) => f(g(v, ctx), ctx));
        }
        return new MapF(p, f);
    }
    _parseWith(context) {
        let position = context.position;
        let result = this._p._parseWith(context);
        let tokenCtx = context;
        context.range = [position, context.position];
        return this._f(result, tokenCtx);
    }
    // Unsafe, because we allowed changing state in map function
    thenR(next) {
        return this._p.thenR(next);
    }
    thenL(next) {
        return MapF.compose(this._p.thenL(next), this._f);
    }
    _checkNullable() {
        return this._p.isNullable();
    }
    _deref() {
        this._p = this._p._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
}
class StateF extends Parser {
    constructor(_p, _f) {
        super();
        this._p = _p;
        this._f = _f;
    }
    _parseWith(context) {
        let startPos = context.position;
        let result = this._p._parseWith(context);
        if (Kit_1.isResultOK(result)) {
            context.range = [startPos, context.position];
            context.state = this._f(context.state, context);
        }
        return result;
    }
    _checkNullable() {
        return this._p.isNullable();
    }
    _deref() {
        this._p = this._p._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
}
exports.StateF = StateF;
/**
Restricted Monad bind, function f can not return Ref reference to other parsers, in this way we dont need to check LeftRecur in parsing
*/
class ThenF extends Parser {
    constructor(_p, _f) {
        super();
        this._p = _p;
        this._f = _f;
    }
    _parseWith(context) {
        let position = context.position;
        let result = this._p._parseWith(context);
        if (Kit_1.isResultOK(result)) {
            let tokenCtx = context;
            tokenCtx.range = [position, context.position];
            let nextP = this._f(result.value, tokenCtx);
            let nextResult = nextP._parseWith(context);
            return nextResult;
        }
        return result;
    }
    _deref() {
        this._p = this._p._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p.isNullable() ? [] : this._p._getFirstSet();
    }
    _checkNullable() {
        return this._p.isNullable();
    }
}
exports.ThenF = ThenF;
class Optional extends Parser {
    constructor(_p) {
        super();
        this._p = _p;
    }
    _parseWith(context) {
        let { position, state } = context;
        let result = this._p._parseWith(context);
        if (!Kit_1.isResultOK(result) && context.position === position) {
            context.state = state;
            return { value: undefined };
        }
        return result;
    }
    isNullable() {
        return true;
    }
    _deref() {
        this._p = this._p._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
}
exports.Optional = Optional;
class TryParser extends Parser {
    constructor(_p) {
        super();
        this._p = _p;
    }
    _parseWith(context) {
        let { position, state } = context;
        let result = this._p._parseWith(context);
        if (!Kit_1.isResultOK(result)) {
            context.position = position;
            context.state = state;
        }
        return result;
    }
    _checkNullable() {
        return this._p.isNullable();
    }
    _deref() {
        this._p = this._p._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
}
exports.TryParser = TryParser;
class Lookahead extends Parser {
    constructor(_p, _look, _negative) {
        super();
        this._p = _p;
        this._look = _look;
        this._negative = _negative;
    }
    _parseWith(context) {
        let result = this._p._parseWith(context);
        if (Kit_1.isResultOK(result)) {
            let { position, state } = context;
            let a = this._look._parseWith(context);
            context.position = position;
            context.state = state;
            let ok = Kit_1.isResultOK(a);
            if (ok === this._negative) {
                if (ok)
                    return { error: { position: position, parser: this } };
                else
                    return a;
            }
        }
        return result;
    }
    _checkNullable() {
        return this._look.isNullable();
    }
    _deref() {
        this._p = this._p._getDeref();
        this._look = this._look._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
}
exports.Lookahead = Lookahead;
class Seqs extends Parser {
    constructor(_items) {
        super();
        this._items = _items;
        if (!_items.length)
            throw new Error('Seqs can not be empty');
    }
    thenR(next) {
        return new Seqs(this._items.concat([next])).map(a => a[a.length - 1]);
    }
    at(n) {
        return this.map(a => a[n]);
    }
    _parseWith(context) {
        let plist = this._items;
        let value = [];
        for (let i = 0; i < plist.length; i++) {
            let p = plist[i];
            let result = p._parseWith(context);
            if (Kit_1.isResultOK(result)) {
                value.push(result.value);
            }
            else {
                return result;
            }
        }
        return { value };
    }
    _checkNullable() {
        for (let p of this._items) {
            if (!p.isNullable())
                return false;
        }
        return true;
    }
    _deref() {
        for (let i = 0; i < this._items.length; i++) {
            this._items[i] = this._items[i]._getDeref();
        }
        return this;
    }
    _getFirstSet() {
        let all = [];
        for (let p of this._items) {
            let first = p._getFirstSet();
            all = all.concat(first);
            if (!p.isNullable()) {
                return all;
            }
        }
        return all;
    }
    desc() {
        let seqs = this._items.map(p => p.desc()).join(',');
        return `Seqs(${seqs})`;
    }
}
exports.Seqs = Seqs;
class Alts extends Parser {
    constructor(_alts) {
        super();
        this._alts = _alts;
        if (!_alts.length)
            throw new Error('Alts can not be empty');
    }
    _parseWith(context) {
        let plist = this._alts;
        let len = plist.length;
        let result;
        let i = 0;
        let { position, state } = context;
        do {
            result = plist[i]._parseWith(context);
            if (Kit_1.isResultOK(result) || context.position !== position)
                return result;
            context.position = position;
            context.state = state;
        } while (++i < len);
        return result;
    }
    _checkNullable() {
        for (let p of this._alts) {
            if (p.isNullable())
                return true;
        }
        return false;
    }
    _deref() {
        for (let i = 0; i < this._alts.length; i++) {
            this._alts[i] = this._alts[i]._getDeref();
        }
        return this;
    }
    _getFirstSet() {
        let all = [];
        for (let p of this._alts) {
            let aset = p._getFirstSet();
            all = all.concat(aset);
        }
        return all;
    }
    desc() {
        let alts = this._alts.map(p => p.desc()).join(',');
        return `Alts(${alts})`;
    }
}
exports.Alts = Alts;
class Repeat extends Parser {
    constructor(_p, _min = 0, _max = Infinity) {
        super();
        this._p = _p;
        this._min = _min;
        this._max = _max;
    }
    _parseWith(context) {
        let count = 0;
        let value = [];
        for (; count < this._max; count++) {
            let oldPosition = context.position;
            let result = this._p._parseWith(context);
            if (Kit_1.isResultOK(result)) {
                value.push(result.value);
            }
            else {
                if (context.position !== oldPosition || count < this._min) {
                    return result;
                }
                break;
            }
        }
        return { value };
    }
    isNullable() {
        return this._min === 0;
    }
    _deref() {
        this._p = this._p._getDeref();
        if (this._p.isNullable()) {
            throw new Error('Repeat on nullable parser:' + this._p.desc());
        }
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
    desc() {
        return `${this._p.desc()}.repeat(${this._min},${this._max})`;
    }
}
exports.Repeat = Repeat;
// @singleton
class Empty extends Parser {
    _parseWith(context) {
        return { value: undefined };
    }
    isNullable() {
        return true;
    }
}
// @singleton
class EOF extends Empty {
    _parseWith(context) {
        if (context.position === context.input.length)
            return { value: undefined };
        else
            return { error: { position: context.position, parser: this } };
    }
}
class FailParser extends Parser {
    constructor(_msg, _userError) {
        super();
        this._msg = _msg;
        this._userError = _userError;
    }
    _parseWith(context) {
        let a = { error: { parser: this, position: context.position, message: this._msg } };
        if (this._userError !== undefined) {
            a.error.userError = this._userError;
        }
        return a;
    }
    isNullable() {
        return true;
    }
}
class Exact extends Parser {
    constructor(_s) {
        super();
        this._s = _s;
        if (!_s.length)
            throw new Error('Exact match empty make no sense, please use Parsec.empty instead!');
    }
    _parseWith(context) {
        let l = this._s.length;
        let { input, position } = context;
        let s = input.slice(position, position + l);
        if (s === this._s || K.deepEqual(s, this._s)) {
            context.position += l;
            return { value: this._s };
        }
        else {
            return { error: { position: position, parser: this } };
        }
    }
    isNullable() {
        return false;
    }
    desc() {
        return `Exact(${JSON.stringify(this._s)})`;
    }
}
exports.Exact = Exact;
function _repeats(min = 0, max = Infinity) {
    let re = '(?:' + this.getRegexSource() + ')';
    let quantifier = '{' + min + ',' + (max === Infinity ? '' : max) + '}';
    let p = new MatchRegex(new RegExp(re + quantifier, 'u'));
    return p.map(m => m[0]);
}
function _counts(n) {
    return this.repeats(n, n);
}
class CharsetBase extends Parser {
    constructor() {
        super(...arguments);
        this.repeats = _repeats;
        this.counts = _counts;
    }
    _parseWith(context) {
        let { position, input } = context;
        let cp = input.codePointAt(position);
        if (typeof cp === 'undefined') {
            return {
                error: { position: position, parser: this, message: 'EOF' }
            };
        }
        else if (this._includeCodePoint(cp)) {
            let c = String.fromCodePoint(cp);
            context.position += c.length;
            return { value: c };
        }
        else {
            return { error: { position: position, parser: this } };
        }
    }
    isNullable() {
        return false;
    }
    _getDeref() {
        return this;
    }
}
class CharsetParser extends CharsetBase {
    constructor(_charset) {
        super();
        this._charset = _charset;
    }
    _includeCodePoint(cp) {
        return this._charset.includeCodePoint(cp);
    }
    getRegexSource() {
        return this._charset.toRegex().source;
    }
    desc() {
        return `Charset(${JSON.stringify(this._charset.toPattern())})`;
    }
}
exports.CharsetParser = CharsetParser;
class OneOf extends CharsetBase {
    constructor(a) {
        super();
        this._set = new Set(Array.from(a).map(K.Char.ord));
    }
    _includeCodePoint(cp) {
        return this._set.has(cp);
    }
    getRegexSource() {
        return K.Charset.fromCodePoints(Array.from(this._set)).toRegex().source;
    }
    desc() {
        return (this.constructor.name +
            `(${JSON.stringify(Array.from(this._set)
                .map(K.Char.chr)
                .join(''))})`);
    }
}
exports.OneOf = OneOf;
class NoneOf extends OneOf {
    _includeCodePoint(cp) {
        return !this._set.has(cp);
    }
    getRegexSource() {
        return K.Charset.fromCodePoints(Array.from(this._set))
            .inverted()
            .toRegex().source;
    }
}
exports.NoneOf = NoneOf;
class MatchRegex extends Parser {
    constructor(re) {
        super();
        this.repeats = _repeats;
        this.counts = _counts;
        this._rawRe = re;
        this._re = new RegExp(re.source, re.flags.replace('y', '') + 'y');
    }
    _parseWith(context) {
        let { input, position } = context;
        this._re.lastIndex = position;
        let m = this._re.exec(input);
        if (m === null) {
            return { error: { position: position, parser: this } };
        }
        else {
            context.position += m[0].length;
            return { value: m };
        }
    }
    slice() {
        return this.map(m => m[0]);
    }
    _checkNullable() {
        return this._re.test('');
    }
    getRegexSource() {
        return this._rawRe.source;
    }
    desc() {
        return `Regex(${this._rawRe.toString()})`;
    }
}
exports.MatchRegex = MatchRegex;
// @private
class Ref extends Parser {
    constructor(_refName) {
        super();
        this._refName = _refName;
    }
    resolveRef(ruleMap) {
        let p = ruleMap[this._refName];
        if (!p) {
            throw new Error('Referenced rule does not exist: ' + this._refName);
        }
        this._p = p;
    }
    isNullable() {
        return this._p.isNullable();
    }
    _getFirstSet() {
        return [this];
    }
    _getDeref() {
        return this._p._getDeref();
    }
    _parseWith(...args) {
        throw new Error('Ref Parser ' + this._refName + ' should not be called');
    }
}
class LeftRecur extends Parser {
    constructor(_p) {
        super();
        this._p = _p;
        if (_p.isNullable())
            throw new Error('LeftRecur on nullable parser:' + _p.desc());
    }
    _parseWith(context) {
        let { recurMemo, position, state } = context;
        let memoMap = recurMemo.get(this);
        if (!memoMap) {
            memoMap = new Map();
            recurMemo.set(this, memoMap);
        }
        let last = memoMap.get(position);
        if (last) {
            context.position = last.position;
            context.state = last.state;
            return last.result;
        }
        last = {
            position: position,
            state: state,
            result: { error: { position: position, parser: this } }
        };
        memoMap.set(position, last);
        while (true) {
            context.position = position;
            context.state = state;
            let result = this._p._parseWith(context);
            if (context.position <= last.position) {
                return last.result;
            }
            else if (!Kit_1.isResultOK(result)) {
                return result;
            }
            last.result = result;
            last.position = context.position;
        }
    }
    isNullable() {
        return false;
    }
    _deref() {
        this._p = this._p._getDeref();
        return this;
    }
    _getFirstSet() {
        return this._p._getFirstSet();
    }
    desc() {
        return 'Recur(' + this._p.desc() + ')';
    }
}
const _objectPrototypePropertyNames = new Set(Object.getOwnPropertyNames(Object.prototype));
/**
 * Get object all available property names,include its prototype chain but exclude top Object.prototype
 */
function getDefRuleNames(a) {
    let names = [];
    let proto = a;
    while (proto && proto !== Object.prototype) {
        names = names.concat(Object.getOwnPropertyNames(proto));
        proto = Object.getPrototypeOf(proto);
    }
    names = names.filter(n => !_objectPrototypePropertyNames.has(n));
    return K.sortUnique(names);
}
class Grammar {
    constructor(_rawDef) {
        this.parseWithState = ((s, initalState = null) => {
            let rules = this.rules;
            if (rules.Main) {
                return rules.Main.parse(s, initalState);
            }
        });
        this.parse = this.parseWithState;
        let rawDef = _rawDef;
        let ruleNames = getDefRuleNames(_rawDef).filter(k => rawDef[k] instanceof Function || rawDef[k] instanceof Parser);
        let ruleMap = Object.create(null);
        let thisObject = Object.create(null);
        let refMap = Object.create(null);
        for (let k of ruleNames) {
            let p = rawDef[k];
            if (typeof p === 'function') {
                refMap[k] = new Ref(k);
                thisObject[k] = () => refMap[k];
            }
            else {
                thisObject[k] = p;
            }
        }
        for (let k of ruleNames) {
            let df = rawDef[k];
            let p;
            if (typeof df === 'function') {
                p = df.call(thisObject);
                if (!(p instanceof Parser)) {
                    throw new TypeError(`Grammar Definition clause "${k}" function must return Parser`);
                }
            }
            else {
                p = df;
            }
            if (p instanceof Parser) {
                // Allow extra utility non parser property in grammar class
                ruleMap[k] = p;
            }
        }
        let refNames = Object.getOwnPropertyNames(refMap);
        for (let k of refNames) {
            refMap[k].resolveRef(ruleMap);
        }
        for (let k of ruleNames) {
            // Fix left recursion
            let firstSet = ruleMap[k]._getFirstSet();
            let selfRef = refMap[k];
            if (firstSet.includes(selfRef)) {
                ruleMap[k] = new LeftRecur(ruleMap[k]);
            }
        }
        for (let k of refNames) {
            refMap[k].resolveRef(ruleMap);
        }
        for (let k of ruleNames) {
            ruleMap[k] = ruleMap[k]._getDeref();
        }
        this.rules = ruleMap;
    }
    static def(rawDef) {
        return new Grammar(rawDef);
    }
}
exports.Grammar = Grammar;
/**
We have to pre-specify these generic types due to TypeScript lacks of value polymorphism
*/
function refine() {
    const spaces = re(/\s*/);
    /**
    Parse by a custom function, it must return a consumed number in order to increase the position
    */
    function parseBy(f) {
        return new FParser(f);
    }
    function getState() {
        return parseBy(ctx => ({ value: ctx.state, consumed: 0 }));
    }
    function re(re) {
        return new MatchRegex(re);
    }
    return {
        seqs,
        alts,
        bind,
        re,
        parseBy,
        getState,
        empty: new Empty(),
        eof: new EOF(),
        digit: re(/\d/).slice(),
        digits: re(/\d*/).slice(),
        digits1: re(/\d+/).slice(),
        hexDigit: re(/[A-F0-9]/i).slice(),
        hexDigits: re(/[A-F0-9]*/i).slice(),
        hexDigits1: re(/[A-F0-9]+/i).slice(),
        letter: re(/[A-Z]/i).slice(),
        letters: re(/[A-Z]*/i).slice(),
        letters1: re(/[A-Z]+/).slice(),
        spaces,
        spaces1: re(/\s+/),
        pure(a) {
            return parseBy(_ => ({ value: a, consumed: 0 }));
        },
        anyChar: new FParser(ctx => {
            let cp = ctx.input.codePointAt(ctx.position);
            if (typeof cp === 'undefined') {
                return { error: 'EOF', consumed: 0 };
            }
            else {
                let c = String.fromCodePoint(cp);
                return {
                    value: c,
                    consumed: c.length
                };
            }
        }),
        oneOf(a) {
            return new OneOf(a);
        },
        noneOf(a) {
            return new NoneOf(a);
        },
        exact(s) {
            return new Exact(s);
        },
        charset(ch) {
            return new CharsetParser(ch);
        },
        spaced(p) {
            let sp = spaces;
            return seqs(sp, p, sp).at(1);
        },
        fails(msg) {
            return new FailParser(msg);
        },
        failWith(err) {
            return new FailParser('UserError', err);
        }
    };
    function alts(...parsers) {
        return new Alts(parsers);
    }
    function seqs(...parsers) {
        return new Seqs(parsers);
    }
    function bind(..._bindings) {
        let bindings = _bindings;
        let { names, parsers } = bindings.reduce((prev, cur) => {
            prev.names = prev.names.concat(Object.keys(cur));
            prev.parsers = prev.parsers.concat(Object.values(cur));
            return prev;
        }, { names: [], parsers: [] });
        let seq = new Seqs(parsers).map(values => {
            let a = {};
            for (let i = 0; i < names.length; i++) {
                a[names[i]] = values[i];
            }
            return a;
        });
        return seq;
    }
}
exports.refine = refine;
//# sourceMappingURL=Parsec.js.map