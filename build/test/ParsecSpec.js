"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Parsec = require("../src/Parsec");
const K = require("../src/Kit");
const C = require("fast-check");
const utils_1 = require("./utils");
const chai_1 = require("chai");
const P = Parsec.refine();
function unicodes() {
    return C.fullUnicodeString(1, 10);
}
const PrimeParser = {
    Exacts(s) {
        return { parser: P.exact(s), input: s, expect: { consumed: s.length, value: s } };
    },
    OneOf(s) {
        let c = Array.from(s).pop();
        return { parser: P.oneOf(s), input: c, expect: { consumed: c.length, value: c } };
    },
    NoneOf(s) {
        let charset = K.Charset.fromChars(s).inverted();
        let c = utils_1.sampleInCharset(charset, 1)[0];
        return { parser: P.noneOf(s), input: c, expect: { consumed: c.length, value: c } };
    },
    Charset(s) {
        let charset = K.Charset.fromChars(s);
        let c = utils_1.sampleInCharset(charset, 1)[0];
        return { parser: P.charset(charset), input: c, expect: { consumed: c.length, value: c } };
    },
    RepeatOneOf(s) {
        return {
            parser: P.oneOf(s).repeat(),
            input: s,
            expect: { consumed: s.length, value: Array.from(s) }
        };
    },
    RepeatNoneOf(s) {
        let charset = K.Charset.fromChars(s).inverted();
        let input = utils_1.sampleInCharset(charset).join('');
        let chars = Array.from(input);
        return { parser: P.noneOf(s).repeat(), input: input, expect: { consumed: input.length, value: chars } };
    },
    CountsOneOf(s) {
        return {
            parser: P.oneOf(s).counts(Array.from(s).length),
            input: s,
            expect: { consumed: s.length, value: s }
        };
    },
    CountsNoneOf(s) {
        let charset = K.Charset.fromChars(s).inverted();
        let input = utils_1.sampleInCharset(charset).join('');
        return {
            parser: P.noneOf(s).counts(Array.from(input).length),
            input: input,
            expect: { consumed: input.length, value: input }
        };
    },
    RegexRepeat(s) {
        let re = P.re(new RegExp(K.escapeRegex(s)))
            .repeats()
            .slice();
        let input = new Array(10).join(s);
        return { parser: re, input: input, expect: { consumed: input.length, value: input } };
    },
    GetState(s) {
        let p = P.getState().thenF((st, ctx) => {
            return P.exact(st.whole);
        });
        let input = s;
        return { parser: p, input: input, expect: { consumed: input.length, value: input } };
    },
    ThenF(s) {
        let s1 = s.toLowerCase();
        let s2 = s.toUpperCase();
        let p = P.exact(s1).thenF(v1 => {
            return P.exact(v1.toUpperCase()).map(v2 => v2 + v1);
        });
        let input = s1 + s2;
        return { parser: p, input: input, expect: { consumed: input.length, value: s2 + s1 } };
    }
};
const ComboParser = {
    Seqs(seqs) {
        let input = seqs.map(p => p.input).join('');
        let consumed = K.sum(seqs.map(p => p.expect.consumed));
        let value = seqs.map(p => p.expect.value);
        let parsers = seqs.map(p => p.parser);
        return { parser: P.seqs(...parsers), input, expect: { consumed, value } };
    },
    Alts(alts, i) {
        let choosed = alts[i];
        let parsers = alts.map(p => p.parser);
        return { parser: P.alts(...parsers), input: choosed.input, expect: choosed.expect };
    },
    ThenR(seqs) {
        let input = seqs.map(p => p.input).join('');
        let consumed = K.sum(seqs.map(p => p.expect.consumed));
        let value = seqs[seqs.length - 1].expect.value;
        let parser = seqs.map(p => p.parser).reduce((p1, p2) => p1.thenR(p2));
        return { parser: parser, input, expect: { consumed, value } };
    },
    Slice(p) {
        p.expect.value = p.input;
        p.parser = p.parser.slice();
        return p;
    }
};
const UtilGen = {
    Empty() {
        return { parser: P.empty, input: '', expect: { consumed: 0, value: undefined } };
    },
    EOF() {
        return { parser: P.eof, input: '', expect: { consumed: 0, value: undefined } };
    }
};
const Gen = {
    SeqsRepeatOneOfNoneOf() {
        return unicodes().map(s => {
            let p1 = PrimeParser.RepeatOneOf(s);
            let p2 = PrimeParser.RepeatNoneOf(s);
            let seqs = [p1, p2, p1, p2];
            return ComboParser.Seqs(seqs);
        });
    },
    SeqsExacts() {
        return C.array(unicodes(), 1, 20).map(slist => {
            let seqs = slist.map(PrimeParser.Exacts);
            seqs = seqs.concat([UtilGen.Empty(), UtilGen.EOF()]);
            return ComboParser.Seqs(seqs);
        });
    },
    SeqsLast() {
        return C.array(unicodes(), 1, 20).map(slist => {
            let seqs = slist.map(PrimeParser.Exacts);
            return ComboParser.ThenR(seqs);
        });
    },
    AltsExacts() {
        return C.array(unicodes(), 1, 20).chain(slist => {
            // string list may have overlaps, sort by length reverse to avoid consumed by early prefix
            slist = slist.sort((a, b) => a.length - b.length).reverse();
            return C.nat(slist.length - 1).map(i => {
                let alts = slist.map(PrimeParser.Exacts);
                return ComboParser.Alts(alts, i);
            });
        });
    },
    TryAlts() {
        return Gen.SeqsExacts().map(p => {
            let failP = {
                parser: p.parser.thenR(P.fails('Try End Fail')).trys(),
                input: p.input,
                expect: p.expect
            };
            return ComboParser.Alts([failP, p], 1);
        });
    },
    Slice() {
        let _Gen = Gen;
        let gens = Object.keys(_Gen)
            .filter(k => k !== 'Slice')
            .map(k => _Gen[k]);
        return C.constantFrom(...gens)
            .chain(f => f())
            .map(ComboParser.Slice);
    },
    Bind() {
        return C.array(unicodes(), 1, 20).map(slist => {
            let seqs = slist.map(PrimeParser.Exacts);
            seqs = seqs.concat([UtilGen.Empty(), UtilGen.EOF()]);
            let input = seqs.map(p => p.input).join('');
            let consumed = K.sum(seqs.map(p => p.expect.consumed));
            let names = seqs.map(_ => K.guid());
            let value = {};
            seqs.forEach((cur, i) => {
                value[names[i]] = cur.expect.value;
            });
            let parsers = seqs.map((p, i) => ({ [names[i]]: p.parser }));
            return { parser: P.bind(...parsers), input, expect: { consumed, value } };
        });
    }
};
function testParser(title, gen) {
    utils_1.testProp(title, gen, g => {
        let { parser, input, expect } = g;
        let state = { counter: 1, whole: input };
        let result = parser.parse(input, state);
        chai_1.assert(K.isResultOK(result));
        chai_1.assert(result.consumed == expect.consumed);
        if (K.isResultOK(result)) {
            chai_1.assert.deepEqual(result.value, expect.value);
        }
        chai_1.assert.deepEqual(result.state, state, 'State should keep');
        let parser2 = parser.stateF(st => {
            st.counter++;
            return st;
        });
        let result2 = parser2.parse(input, state);
        chai_1.assert.equal(result2.state.counter, 2, 'State should change');
    });
}
class BaseDef {
    Factor() {
        return P.spaced(P.alts(this.Expr().betweens('(', ')'), this.Num()));
    }
    Expr() {
        return P.alts(P.seqs(this.Expr(), this.Op, this.Factor()).map(evalExpr), this.Factor());
    }
}
class ArithDef extends BaseDef {
    constructor() {
        super(...arguments);
        this.Op = P.oneOf('+-');
    }
    Main() {
        return this.Expr();
    }
    Num() {
        return P.re(/-?\s*\d+(?:\.\d+)?/)
            .slice()
            .map(s => Number(s.replace(/\s+/g, '')));
    }
}
const Arith = Parsec.Grammar.def(new ArithDef());
function evalExpr(e) {
    let [a, op, b] = e;
    switch (op) {
        case '+':
            return a + b;
        case '-':
            return a - b;
    }
    throw new Error('Unexpected operator:' + op);
}
describe('Parsec', function () {
    describe('Prime', () => {
        for (let k in PrimeParser) {
            let gen = K.IndexSig(PrimeParser)[k];
            testParser(k, unicodes().map(gen));
        }
    });
    describe('Combo', () => {
        for (let k in Gen) {
            let gen = K.IndexSig(Gen)[k];
            testParser(k, gen());
        }
    });
    const expr = '3.2 -  3 + 45 - (454 - -23) - (23 - (- 423)+ (  3 - (0.3+45 )) - 44.345)';
    it('LeftRecur', () => {
        let result = Arith.parse(expr);
        if (K.isResultOK(result))
            chai_1.assert.equal(result.value, eval(expr));
        else {
            console.dir(result.error, { depth: 10 });
            chai_1.assert.fail('Arith');
        }
    });
});
//# sourceMappingURL=ParsecSpec.js.map