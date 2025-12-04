"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FC = require("fast-check");
const K = require("../../src/Kit");
const utils_1 = require("../utils");
const immer_1 = require("immer");
const _ = require("lodash");
const UnicodeProperty = require("../../src/UnicodeProperty");
const Unicode_1 = require("../../src/Unicode");
const AST = require("../../src/AST");
const GBase = require("../../src/grammar/Base");
const path = require("path");
const fs = require("fs");
const chai_1 = require("chai");
const assert_1 = require("assert");
function makeGenState() {
    return { pos: 0, groups: { depth: 0, count: 0, names: [] }, liveGroups: { indices: [], names: [] }, liveGroupsBackup: [] };
}
exports.makeGenState = makeGenState;
/**
"\0" + "1"  will result in OctEscape or Backref error
*/
function isSticky(t1, t2) {
    return /\\\d*$/.test(t1.source) && /^\d/.test(t2.source);
}
exports.isSticky = isSticky;
function fixStateRange(initialState) {
    return t1 => immer_1.produce(t1, t2 => {
        t2.state = immer_1.produce(t2.state || initialState, st => void (st.pos = initialState.pos + t2.source.length));
        t2.expect.range = [initialState.pos, t2.state.pos];
    });
}
exports.fixStateRange = fixStateRange;
class BaseGen {
    constructor(flags, maxGroupDepth = 30) {
        this.flags = flags;
        this.maxGroupDepth = maxGroupDepth;
    }
    Dot(state) {
        return FC.constant({
            source: '.',
            expect: { type: 'Dot' }
        }).map(fixStateRange(state));
    }
    Char(state) {
        let { flags } = this;
        let UnicodeEscape = flags.unicode
            ? FC.oneof(UtilGen.BaseUnicodeEscape, UtilGen.CodePointEscape, UtilGen.UnicodePairEscape)
            : UtilGen.BaseUnicodeEscape;
        let ExactChar = flags.unicode ? UtilGen.ExactChar : UtilGen.ExactChar16;
        // Use constantFrom for better shrink result
        return FC.tuple(UtilGen.AlphaChar, UtilGen.AlphanumChar, ExactChar, UtilGen.IdentityEscape, UtilGen.HexEscape, UtilGen.ControlEscape, UtilGen.ControlLetter, UtilGen.NullChar, UnicodeEscape)
            .chain(a => FC.constantFrom(...a))
            .map(t => {
            return {
                source: t.source,
                expect: { type: 'Char', value: t.expect }
            };
        })
            .map(fixStateRange(state));
    }
    CharClassEscape(state) {
        let { flags } = this;
        let gen = flags.unicode ? FC.oneof(UtilGen.BaseCharClass, UtilGen.UnicodeCharClass) : UtilGen.BaseCharClass;
        return gen
            .map(t => {
            return {
                source: '\\' + t.source,
                expect: { type: 'CharClassEscape', charClass: t.expect }
            };
        })
            .map(fixStateRange(state));
    }
    CharClass(state) {
        let genCharItemF = st => this.Char(st)
            .map(t1 => {
            if (!'-^'.includes(t1.source))
                return t1;
            return immer_1.produce(t1, t2 => {
                t2.source = '\\' + t1.source;
            });
        })
            .map(fixStateRange(st));
        let genRangeItemF = st => FC.tuple(genCharItemF(st), genCharItemF(st))
            .map(a => {
            a = immer_1.produce(a, a => {
                let [c1, c2] = a.sort((t1, t2) => K.compareFullUnicode(t1.expect.value, t2.expect.value));
                AST.indent(c2.expect, c1.source.length + 1);
            });
            let source = a.map(t => t.source).join('-');
            return {
                source,
                expect: {
                    type: 'CharRange',
                    begin: a[0].expect,
                    end: a[1].expect
                }
            };
        })
            .map(fixStateRange(st));
        let genCharClassItemF = FC.constantFrom(genCharItemF, state => this.CharClassEscape(state), genRangeItemF);
        return FC.record({
            invert: FC.boolean(),
            bodyFns: FC.array(genCharClassItemF)
        })
            .chain(t => {
            let { invert, bodyFns } = t;
            let state1 = immer_1.produce(state, st => {
                st.pos += invert ? 2 : 1;
            });
            let bodyGen = FC.constant({ state: state1, source: '', expect: [] });
            for (let fn of bodyFns) {
                bodyGen = bodyGen.chain(acc => {
                    return fn(acc.state).map(t2 => {
                        if (isSticky(acc, t2))
                            return acc;
                        return {
                            source: acc.source + t2.source,
                            state: t2.state,
                            expect: acc.expect.concat(t2.expect)
                        };
                    });
                });
            }
            return bodyGen.map(g => {
                return {
                    source: '[' + (invert ? '^' : '') + g.source + ']',
                    expect: {
                        type: 'CharClass',
                        invert,
                        body: g.expect
                    }
                };
            });
        })
            .map(fixStateRange(state));
    }
    BaseAssertion(state) {
        let symbols = Object.keys(GBase.baseAssertionTypeMap);
        return FC.constantFrom(...symbols)
            .map(source => {
            let a = GBase.baseAssertionTypeMap[source];
            return {
                source,
                expect: { type: 'BaseAssertion', kind: a }
            };
        })
            .map(fixStateRange(state));
    }
    Backref(state) {
        FC.pre(state.liveGroups.indices.length > 0);
        let numRef = FC.constantFrom(...state.liveGroups.indices).map(i => {
            return { source: '\\' + i, index: i };
        });
        let ref = numRef;
        if (state.liveGroups.names.length > 0) {
            let nameRef = FC.constantFrom(...state.liveGroups.names).map(n => {
                return { source: '\\k<' + n + '>', index: n };
            });
            ref = FC.oneof(numRef, nameRef);
        }
        return ref
            .map(({ source, index }) => {
            return {
                source,
                expect: { type: 'Backref', index }
            };
        })
            .map(fixStateRange(state));
    }
    Expr(state, excludes) {
        const leafGenNames = ['Dot', 'Char', 'CharClassEscape', 'CharClass', 'BaseAssertion'];
        const recurGenNames = ['GroupAssertion', 'Group', 'List', 'Disjunction', 'Repeat'];
        let names = leafGenNames.slice();
        if (state.liveGroups.indices.length > 0) {
            names.push('Backref');
        }
        if (state.groups.depth < this.maxGroupDepth) {
            names = names.concat(recurGenNames);
        }
        if (excludes) {
            names = names.filter(n => !excludes.includes(n));
        }
        return FC.constantFrom(...names).chain(fname => this[fname](state));
    }
    Disjunction(state) {
        let liveGroups0 = state.liveGroups;
        let state1 = immer_1.produce(state, st => void st.liveGroupsBackup.push(st.liveGroups));
        let bodyGen = FC.integer(2, 10).chain(n => {
            let genAcc = FC.constant({ source: [], expect: [], state: state1 });
            while (n--) {
                genAcc = genAcc.chain(acc => {
                    let state2 = immer_1.produce(acc.state, st => void (st.liveGroups = liveGroups0));
                    return this.Expr(state2, ['Disjunction']).map(t => {
                        let newState = immer_1.produce(t.state, st => {
                            st.pos++;
                            // merge groups in each branch when leave Disjunction
                            let g = st.liveGroupsBackup.slice(-1)[0];
                            g.indices.push(...st.liveGroups.indices.slice(liveGroups0.indices.length));
                            g.names.push(...st.liveGroups.names.slice(liveGroups0.names.length));
                        });
                        return {
                            state: newState,
                            source: acc.source.concat(t.source),
                            expect: acc.expect.concat(t.expect)
                        };
                    });
                });
            }
            return genAcc;
        });
        return bodyGen
            .map(t => {
            return {
                source: t.source.join('|'),
                state: immer_1.produce(t.state, st => void st.liveGroupsBackup.pop()),
                expect: {
                    type: 'Disjunction',
                    body: t.expect
                }
            };
        })
            .map(fixStateRange(state));
    }
    List(state) {
        let genBody = FC.integer(0, this.maxGroupDepth).chain(n => {
            let genAcc = FC.constant({ source: '', state, expect: [] });
            while (n--) {
                genAcc = genAcc.chain(acc => {
                    return this.Expr(acc.state, ['List', 'Disjunction']).map(t => {
                        if (isSticky(acc, t))
                            return acc;
                        return {
                            source: acc.source + t.source,
                            state: t.state,
                            expect: acc.expect.concat(t.expect)
                        };
                    });
                });
            }
            return genAcc.map(t => {
                if (t.expect.length === 1) {
                    // When ListNode body only contains one node N, it will be unwrapped to N in parsing.
                    // But here we must return a ListNode, so does the empty body
                    return { source: '', state, expect: [] };
                }
                return t;
            });
        });
        return genBody.map(({ source, state: newState, expect: body }) => ({
            source,
            state: newState,
            expect: { type: 'List', body, range: [state.pos, newState.pos] }
        }));
    }
    Group(state) {
        return this.GroupBehavior(immer_1.produce(state, st => void st.pos++)).chain(behaviorCase => {
            let behavior = behaviorCase.expect;
            let state1 = immer_1.produce(behaviorCase.state, st => {
                st.groups.depth++;
                if (behavior.type === 'Capturing') {
                    st.groups.count++;
                    if (behavior.name) {
                        st.groups.names.push(behavior.name);
                    }
                }
            });
            return this.Expr(state1).map(bodyCase => {
                let source = '(' + behaviorCase.source + bodyCase.source + ')';
                let newState = immer_1.produce(bodyCase.state, st => {
                    st.pos++;
                    st.groups.depth--;
                    if (behavior.type === 'Capturing') {
                        st.liveGroups.indices.push(state1.groups.count);
                        if (behavior.name) {
                            st.liveGroups.names.push(behavior.name);
                        }
                    }
                });
                let expect = {
                    type: 'Group',
                    body: bodyCase.expect,
                    behavior,
                    range: [state.pos, newState.pos]
                };
                return { source, expect, state: newState };
            });
        });
    }
    GroupAssertion(state) {
        let specifierGen = FC.record({
            look: FC.constantFrom('Lookahead', 'Lookbehind'),
            negative: FC.boolean()
        });
        return specifierGen.chain(sp => {
            let liveGroupsBackup = state.liveGroups;
            let spSource = GBase.invGroupAssertionTypeMap[[sp.look, sp.negative] + ''];
            let state1 = immer_1.produce(state, st => {
                st.pos += spSource.length + 1;
                st.groups.depth++;
            });
            return this.Expr(state1).map(bodyCase => {
                let newState = immer_1.produce(bodyCase.state, st => {
                    st.pos++;
                    st.groups.depth--;
                    if (sp.negative) {
                        st.liveGroups = liveGroupsBackup;
                    }
                });
                return {
                    source: '(' + spSource + bodyCase.source + ')',
                    state: newState,
                    expect: {
                        type: 'GroupAssertion',
                        look: sp.look,
                        negative: sp.negative,
                        body: bodyCase.expect,
                        range: [state.pos, newState.pos]
                    }
                };
            });
        });
    }
    Quantifier(state) {
        let baseQuantifiers = '+?*'.split('').map(c => ({ source: c, expect: GBase.parseBaseQuantifier(c) }));
        return FC.record({
            greedy: FC.boolean(),
            test: FC.oneof(FC.constantFrom(...baseQuantifiers), FC.record({
                min: FC.nat(),
                max: FC.oneof(FC.nat(), FC.constant(Infinity))
            })
                .filter(({ min, max }) => min <= max)
                .map(({ min, max }) => {
                let q = { type: 'Quantifier', min, max, greedy: true };
                let source = GBase.showQuantifier(q);
                return { source, expect: q };
            }))
        })
            .map(({ greedy, test }) => immer_1.produce(test, t => {
            t.expect.greedy = greedy;
            if (greedy === false) {
                t.source += '?';
            }
        }))
            .map(fixStateRange(state));
    }
    Repeat(state) {
        return this.Expr(state, ['Repeat', 'BaseAssertion', 'GroupAssertion', 'List', 'Disjunction']).chain(bodyCase => {
            return this.Quantifier(bodyCase.state).map(q => ({
                source: bodyCase.source + q.source,
                state: q.state,
                expect: {
                    type: 'Repeat',
                    quantifier: q.expect,
                    body: bodyCase.expect,
                    range: [state.pos, q.state.pos]
                }
            }));
        });
    }
}
exports.BaseGen = BaseGen;
var UtilGen;
(function (UtilGen) {
    UtilGen.unicode16 = K.Charset.fromPattern('\0-\uFFFF');
    UtilGen.patternChar = K.Charset.fromChars(GBase.syntaxChars).inverted();
    UtilGen.patternChar16 = UtilGen.patternChar.intersect(UtilGen.unicode16);
    UtilGen.alphanum = K.Charset.fromPattern('A-Za-z0-9');
    UtilGen.alpha = K.Charset.fromPattern('A-Za-z');
    UtilGen.Flags = FC.constant(AST.RegexFlags.create({ unicode: true }));
    UtilGen.ExactChar16 = utils_1.genInCharset(UtilGen.patternChar16).map(c => ({ source: c, expect: c }));
    UtilGen.ExactChar = utils_1.genInCharset(UtilGen.patternChar).map(c => ({ source: c, expect: c }));
    UtilGen.AlphaChar = utils_1.genInCharset(UtilGen.alpha).map(c => ({ source: c, expect: c }));
    UtilGen.AlphanumChar = utils_1.genInCharset(UtilGen.alphanum).map(c => ({ source: c, expect: c }));
    UtilGen.HexEscape = FC.char().map(c => ({ source: K.Char.hexEscape(c), expect: c }));
    UtilGen.ControlEscape = FC.constantFrom(...'fnrtv').map(c => ({
        source: '\\' + c,
        expect: GBase.controlEscapeMap[c]
    }));
    UtilGen.ControlLetter = utils_1.genInCharset(UtilGen.alpha).map(c => ({
        source: '\\c' + c,
        expect: K.Char.ctrl(c)
    }));
    UtilGen.NullChar = FC.constant({ source: '\\0', expect: '\0' });
    UtilGen.BaseUnicodeEscape = FC.unicode().map(c => ({ source: K.Char.unicodeEscape(c), expect: c }));
    UtilGen.CodePointEscape = FC.fullUnicode().map(c => ({ source: K.Char.codePointEscape(c), expect: c }));
    UtilGen.UnicodePairEscape = FC.integer(0x10000, K.Char.MAX_CODE_POINT).map(cp => {
        let c = String.fromCodePoint(cp);
        return { source: K.escapeUnicodes(c, false), expect: c };
    });
    UtilGen.IdentityEscape = FC.constantFrom(...(GBase.syntaxChars + '/')).map(c => ({ source: '\\' + c, expect: c }));
    UtilGen.BaseCharClass = FC.constantFrom(...Object.entries(GBase.charClassEscapeTypeMap).map(a => ({ source: a[0], expect: a[1] })));
    UtilGen.BinaryUnicodeCharClass = FC.constantFrom(...UnicodeProperty.canonical.Binary_Property).map(name => ({ name, invert: false }));
    UtilGen.NonBinaryUnicodeCharClass = FC.constantFrom(...UnicodeProperty.canonical.NonBinary_Property).chain(name => FC.constantFrom(...K.IndexSig(UnicodeProperty.canonical)[name]).map(value => ({ name, value, invert: false })));
    UtilGen.UnicodeCharClass = FC.record({
        invert: FC.boolean(),
        cat: FC.oneof(UtilGen.BinaryUnicodeCharClass, UtilGen.NonBinaryUnicodeCharClass)
    })
        .map(c => immer_1.produce(c.cat, a => void (a.invert = c.invert)))
        .chain(cat => FC.constantFrom(...getAliasForms(cat).map(s => ({ source: (cat.invert ? 'P' : 'p') + '{' + s + '}', expect: cat }))));
    const invAliasMap = K.invertMap(UnicodeProperty.aliasMap);
    function getAliasForms(cat) {
        let toCode = (name, value) => name + (value ? '=' + value : '');
        let forms = [toCode(cat.name, cat.value)];
        let nameAlias = invAliasMap.get(cat.name);
        let valueAlias = cat.value && invAliasMap.get(cat.value);
        if (nameAlias) {
            forms.push(toCode(nameAlias, cat.value));
            if (valueAlias) {
                forms.push(toCode(nameAlias, valueAlias));
            }
        }
        if (valueAlias) {
            forms.push(toCode(cat.name, valueAlias));
        }
        return forms;
    }
    UtilGen.getAliasForms = getAliasForms;
    UtilGen.ID = {
        Start: utils_1.genInCharset(Unicode_1.default.Binary_Property.ID_Start),
        Continue: utils_1.genInCharset(Unicode_1.default.Binary_Property.ID_Continue)
    };
    UtilGen.ID16Bit = {
        Start: utils_1.genInCharset(Unicode_1.default.Binary_Property.ID_Start.intersect(UtilGen.unicode16)),
        Continue: utils_1.genInCharset(Unicode_1.default.Binary_Property.ID_Continue.intersect(UtilGen.unicode16))
    };
})(UtilGen = exports.UtilGen || (exports.UtilGen = {}));
function cleanNodeRange(node) {
    AST.visit(node, {
        defaults(n) {
            n.range = [0, 0];
        }
    });
}
exports.cleanNodeRange = cleanNodeRange;
function runGrammarTest(title, parse, gen) {
    let runProp = utils_1.property(gen, ({ testCase, flags }) => {
        let result = parse(testCase.source, flags);
        if (!K.isResultOK(result)) {
            chai_1.assert(K.isResultOK(result));
            return;
        }
        chai_1.assert.deepEqual(result.value.expr, testCase.expect, K.escapeUnicodes(testCase.source));
        // Test toSource parse idempotency
        let cleanExpr = _.cloneDeep(testCase.expect);
        cleanNodeRange(cleanExpr);
        let source2 = GBase.toSource(cleanExpr);
        let result2 = parse(source2, flags);
        if (!K.isResultOK(result2)) {
            chai_1.assert(K.isResultOK(result2));
            return;
        }
        cleanNodeRange(result2.value.expr);
        chai_1.assert.deepEqual(cleanExpr, result2.value.expr, K.escapeUnicodes(source2));
    });
    it(title, () => {
        try {
            runProp();
        }
        catch (e) {
            if (e instanceof assert_1.AssertionError) {
                let errorLog = './test/log/grammar/' + path.basename(__filename);
                fs.mkdirSync('./test/log/grammar/', { recursive: true });
                fs.writeFileSync(errorLog, 'export const expected = ' +
                    utils_1.prettyPrint(e.expected) +
                    ';\n' +
                    'export const actual = ' +
                    utils_1.prettyPrint(e.actual) +
                    ';\n');
                console.error('See error log:' + errorLog);
            }
            throw e;
        }
    });
}
exports.runGrammarTest = runGrammarTest;
//# sourceMappingURL=BaseGen.js.map