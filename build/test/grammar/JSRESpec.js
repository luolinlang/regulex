"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FC = require("fast-check");
const immer_1 = require("immer");
const AST = require("../../src/AST");
const JSRE = require("../../src/grammar/JSRE");
const BaseGen_1 = require("./BaseGen");
class JSREGen extends BaseGen_1.BaseGen {
    GroupBehavior(state) {
        let { flags } = this;
        // shrink to BaseGroupName via constantFrom
        let BaseGroupName = FC.array(BaseGen_1.UtilGen.AlphaChar, 1, 20).map(a => a.map(t => t.expect).join(''));
        let ID = flags.unicode ? BaseGen_1.UtilGen.ID : BaseGen_1.UtilGen.ID16Bit;
        let GroupName = FC.tuple(BaseGroupName, FC.tuple(ID.Start, FC.array(ID.Continue)).map(([s1, sa]) => s1 + sa.join('')))
            .chain(a => FC.constantFrom(...a))
            .filter(s => !state.groups.names.includes(s));
        return FC.oneof(FC.constantFrom({ source: '?:', expect: { type: 'NonCapturing' }, state: immer_1.produce(state, st => void (st.pos += 2)) }, { source: '', expect: { type: 'Capturing', index: state.groups.count + 1 }, state }), GroupName.map(name => ({
            source: '?<' + name + '>',
            state: immer_1.produce(state, st => void (st.pos += name.length + 3)),
            expect: { type: 'Capturing', index: state.groups.count + 1, name }
        })));
    }
}
exports.JSREGen = JSREGen;
describe('Grammar.JSRE', function () {
    this.timeout(1000000);
    let testTypes = [
        'Char',
        'CharClassEscape',
        'Dot',
        'CharClass',
        'List',
        'Group',
        'BaseAssertion',
        'GroupAssertion',
        'Disjunction',
        'Repeat'
    ];
    let flags = AST.RegexFlags.parse('u');
    let initState = BaseGen_1.makeGenState();
    let baseGen = new JSREGen(flags);
    for (let ty of testTypes) {
        let gen = baseGen[ty](initState);
        BaseGen_1.runGrammarTest(ty, JSRE.parse, gen.map(testCase => ({ flags, testCase })));
    }
});
//# sourceMappingURL=JSRESpec.js.map