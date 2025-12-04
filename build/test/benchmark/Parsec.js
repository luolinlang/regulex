"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PM = require("../../src/Parsec");
const acorn_1 = require("acorn");
const benchmark_1 = require("benchmark");
const P = PM.refine();
const suite = new benchmark_1.Suite();
function toNode(type) {
    return (v, info) => ({ type: type, range: info.range, body: v });
}
let toBinExprNode = toNode('BinaryExpr');
function toBinExpr([a, op, b], info) {
    return toBinExprNode({ left: a, right: b }, info);
}
class BaseDef {
    constructor() {
        this.Op = P.oneOf('+-').map(toNode('BinaryOperator'));
        this.Num = P.re(/\d+(?:\.\d+)?/)
            .slice()
            .map(toNode('Number'));
    }
}
class ArithDef extends BaseDef {
    Main() {
        return this.Expr();
    }
    Factor() {
        return P.spaced(P.alts(this.Expr()
            .betweens('(', ')')
            .map(toNode('Paren')), this.Num));
    }
    Expr() {
        return P.alts(P.seqs(this.Expr(), this.Op, this.Factor()).map(toBinExpr), this.Factor());
    }
}
const Arith = PM.Grammar.def(new ArithDef());
function genExpr(depth) {
    if (!depth)
        return '0';
    return '3.2 + 454 -(2353 + 34 - (2+ (  ' + genExpr(depth - 1) + ' - (0.3+45 )) - 44.345))';
}
const expr = genExpr(180);
/*
let a = Arith.parse(expr);
console.dir(a,{depth:10});

if (!P.isResultOK(a)) {
  console.log(expr.slice(a.error.position-10,a.error.position+10));
}
process.exit();
*/
suite
    .add('Parsec', () => {
    Arith.parse(expr);
})
    .add('Arcorn', () => {
    acorn_1.Parser.parse(expr);
})
    .on('cycle', function (event) {
    console.log(String(event.target));
})
    .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
})
    .run();
//# sourceMappingURL=Parsec.js.map