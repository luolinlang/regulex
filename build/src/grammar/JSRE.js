"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Parsec_1 = require("../Parsec");
const K = require("../Kit");
const AST = require("../AST");
const Base_1 = require("./Base");
const P = Parsec_1.refine();
/** JavaScript Regular Expression Grammar */
class JSREGrammar extends Base_1.BaseGrammar {
    constructor() {
        super(...arguments);
        this.GroupName = this.RegExpIdentifierName.betweens('<', '>');
        this.GroupNameBackref = P.exact('\\k')
            .thenR(this.GroupName)
            .mapE((name, ctx) => {
            return { value: Base_1.asNode('Backref')({ index: name }, ctx) };
        });
    }
    Main() {
        return this.Disjunction();
    }
    Term() {
        return P.alts(this.Assertion()
            .and(this.Quantifier.opt())
            .mapE((a, ctx) => {
            if (a[1]) {
                return { error: { type: 'NothingToRepeat', range: ctx.range } };
            }
            return { value: a[0] };
        }), this.Repeat(), this.Quantifier.mapE((a, ctx) => {
            return { error: { type: 'NothingToRepeat', range: ctx.range } };
        }));
    }
    Repeat() {
        return this.Atom()
            .and(this.Quantifier.opt())
            .map((a, ctx) => {
            let [body, quantifier] = a;
            if (!quantifier)
                return body;
            return Base_1.asNode('Repeat')({ quantifier, body }, ctx);
        });
    }
    Assertion() {
        return P.alts(this.BaseAssertion, P.seqs(this.GroupAssertionBehavior, this.Main(), this.closeParen).map((a, ctx) => {
            let group = a[0].assertion;
            let body = a[1];
            group.body = body;
            return Base_1.asNode('GroupAssertion')(group, ctx);
        }));
    }
    Atom() {
        return P.alts(this.Char, this.Dot, this.AtomEscape(), this.CharClass(), this.Group());
    }
    AtomEscape() {
        return P.alts(this.DecimalEscape, this.GroupNameBackref, this.CharClassEscape, this.CharEscape);
    }
    Group() {
        return P.bind({ behavior: this.GroupBehavior() }, { body: this.Main() })
            .between(this.openParen, this.closeParen)
            .map(Base_1.asNode('Group'));
    }
    GroupBehavior() {
        return P.alts(P.exact('?:').map(_ => ({ type: 'NonCapturing' })), P.exact('?')
            .thenR(this.GroupName)
            .opt()
            .map(name => (name ? { type: 'Capturing', index: 0, name } : { type: 'Capturing', index: 0 })));
    }
    /** This loose mode lexer is not used in strict whole parsing */
    Lexer() {
        const asLexeme = (type) => (_, { range }) => ({ type, range });
        let asBracket = asLexeme('CharClassBracket');
        let asParen = asLexeme('Paren');
        return P.alts(P.exact('|').map(asLexeme('VBar')), P.exact(']').map(asBracket), P.exact(')').map(asParen), P.alts(this.Char, this.Dot, this.BaseAssertion, this.AtomEscape().trys()), P.exact('[')
            .map(asBracket)
            .and(this.CharClassRanges())
            .map(a => [a[0]].concat(a[1])), P.exact('(')
            .map(asParen)
            .and(P.alts(P.re(/\?(:|<[^<>]*>)/)
            .slice()
            .map((_, ctx) => ({ type: 'GroupBehavior', range: ctx.range })), P.alts(...Object.keys(Base_1.groupAssertionTypeMap).map(P.exact)).map((_, ctx) => ({
            type: 'GroupAssertionBehavior',
            range: ctx.range
        }))).opt())
            .map(a => (a[1] ? [a[0], a[1]] : a[0])), this.Quantifier.trys())
            .repeat()
            .map(v => {
            let a = [];
            for (let x of v) {
                if (Array.isArray(x)) {
                    a.push(...x);
                }
                else {
                    a.push(x);
                }
            }
            return a;
        });
    }
}
exports.JSREGrammar = JSREGrammar;
exports.grammar = Parsec_1.Grammar.def(new JSREGrammar());
exports.lexer = exports.grammar.rules.Lexer;
/**
@param re RegExp source
@param flags
@param partial Whether return error on not stop at the end of string
*/
function parse(re, flags, partial = false) {
    if (re instanceof RegExp) {
        flags = flags || AST.RegexFlags.parse(re.flags);
        re = re.source;
    }
    if (!flags) {
        flags = new AST.RegexFlags();
    }
    let state = {
        flags,
        openPairs: [],
        features: { legacy: {} }
    };
    let result = exports.grammar.parseWithState(re, state);
    if (!K.isResultOK(result)) {
        let u = result.error.userError;
        let p = result.error.position;
        return { error: u ? u : { type: 'SyntaxError', range: [p, p] } };
    }
    else {
        if (!partial && result.consumed !== re.length) {
            return { error: { type: 'SyntaxError', range: [result.consumed, result.consumed] } };
        }
        let regex = { expr: result.value, source: re.slice(0, result.consumed), flags };
        let error = Base_1.check(regex.expr);
        if (error) {
            return { error };
        }
        return { value: regex };
    }
}
exports.parse = parse;
function lex(re, flags) {
    let state = {
        flags,
        openPairs: [],
        loose: true,
        features: {
            legacy: {
                octalEscape: true,
                identityEscape: true,
                charClassEscapeInCharRange: true
            }
        }
    };
    let result = exports.lexer.parse(re, state);
    if (K.isResultOK(result)) {
        return result.value;
    }
    else {
        return [];
    }
}
exports.lex = lex;
//# sourceMappingURL=JSRE.js.map