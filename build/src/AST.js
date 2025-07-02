"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const K = require("./Kit");
exports.baseCharClassTuple = ['Digit', 'NonDigit', 'Word', 'NonWord', 'Space', 'NonSpace'];
exports.baseAssertionTypeTuple = ['WordBoundary', 'NonWordBoundary', 'Begin', 'End'];
class RegexFlags {
    constructor() {
        this.unicode = false;
        this.dotAll = false;
        this.global = false;
        this.ignoreCase = false;
        this.multiline = false;
        this.sticky = false;
        this.extended = false;
    }
    static parse(flags, strict = false) {
        let reFlag = new RegexFlags();
        let invalid = [];
        for (let c of flags) {
            let p = RegexFlags.flagMap.get(c);
            if (p) {
                reFlag[p] = true;
            }
            else {
                invalid.push(c);
            }
        }
        if (strict) {
            if (invalid.length) {
                return { error: K.sortUnique(invalid).join('') };
            }
            else {
                return { value: reFlag };
            }
        }
        return reFlag;
    }
    static create(props) {
        let a = new RegexFlags();
        if (props) {
            Object.assign(a, props);
        }
        return a;
    }
    toString() {
        let map = RegexFlags.invFlagMap;
        let keys = Array.from(map.keys()).sort();
        let flags = '';
        for (let k of keys) {
            if (this[k]) {
                flags += map.get(k);
            }
        }
        return flags;
    }
}
RegexFlags.flagMap = new Map([
    ['u', 'unicode'],
    ['g', 'global'],
    ['i', 'ignoreCase'],
    ['s', 'dotAll'],
    ['m', 'multiline'],
    ['y', 'sticky'],
    ['x', 'extended']
]);
RegexFlags.invFlagMap = K.invertMap(RegexFlags.flagMap);
exports.RegexFlags = RegexFlags;
function isBaseCharClass(node) {
    return node.type === 'CharClassEscape' && typeof node.charClass === 'string';
}
exports.isBaseCharClass = isBaseCharClass;
function isAssertion(node) {
    return node.type === 'BaseAssertion' || node.type === 'GroupAssertion';
}
exports.isAssertion = isAssertion;
function isEmptyNode(node) {
    if (node.type === 'List') {
        return !node.body.length;
    }
    else {
        return false;
    }
}
exports.isEmptyNode = isEmptyNode;
function makeEmptyNode(position = 0) {
    return { type: 'List', body: [], range: [position, position] };
}
exports.makeEmptyNode = makeEmptyNode;
const _BranchNodeTypeTuple = [
    'GroupAssertion',
    'Group',
    'Repeat',
    'List',
    'Disjunction',
    'CharClass',
    'CharRange'
];
exports.BranchNodeTypeTuple = _BranchNodeTypeTuple; // The type is only used to assert the tuple included all BranchNode types.
exports.BranchNodeTypeSet = new Set(exports.BranchNodeTypeTuple);
function isBranchNode(n) {
    return exports.BranchNodeTypeSet.has(n.type);
}
exports.isBranchNode = isBranchNode;
function match(node, clause) {
    let v = clause;
    return (v[node.type] || v.defaults)(node);
}
exports.match = match;
function fmap(node, f) {
    if (isBranchNode(node)) {
        if (node.type === 'CharRange') {
            let n = Object.create(node);
            n.begin = f(node.begin);
            n.end = f(node.end);
            return n;
        }
        else if (node.type === 'CharClass' || node.type === 'Disjunction' || node.type === 'List') {
            let n = Object.create(node);
            n.body = node.body.map(f);
            return n;
        }
        else {
            let n = Object.create(node);
            n.body = f(node.body);
            if (node.type === 'Repeat') {
                n.quantifier = f(node.quantifier);
            }
            return n;
        }
    }
    else {
        return node;
    }
}
exports.fmap = fmap;
/**
Bottom up transform node, aka Catamorphism.
*/
function bottomUp(n, f) {
    function cata(n, parent) {
        return f(fmap(n, a => cata(a, n)), parent);
    }
    return cata(n);
}
exports.bottomUp = bottomUp;
function visit(node, visitor, parent) {
    let vf = visitor[node.type] || visitor.defaults;
    if (typeof vf !== 'function') {
        if (vf.enter) {
            vf.enter(node, parent);
        }
        down();
        if (vf.leave) {
            vf.leave(node, parent);
        }
    }
    else {
        vf(node, parent);
        down();
    }
    function down() {
        if (isBranchNode(node)) {
            if (node.type === 'CharRange') {
                visit(node.begin, visitor, node);
                visit(node.end, visitor, node);
            }
            else if (node.type === 'CharClass' || node.type === 'Disjunction' || node.type === 'List') {
                node.body.forEach((n) => visit(n, visitor, node));
            }
            else {
                visit(node.body, visitor, node);
                if (node.type === 'Repeat') {
                    visit(node.quantifier, visitor, node);
                }
            }
        }
    }
}
exports.visit = visit;
function indent(n, indent) {
    visit(n, {
        defaults(node) {
            node.range[0] += indent;
            node.range[1] += indent;
        }
    });
    return n;
}
exports.indent = indent;
function getGroupsInfo(re, _renumber = false) {
    let groups = { count: 0, names: new Set() };
    visit(re, {
        Group(n) {
            if (n.behavior.type === 'Capturing') {
                if (n.behavior.name) {
                    groups.names.add(n.behavior.name);
                }
                groups.count++;
                if (_renumber) {
                    n.behavior.index = groups.count;
                }
            }
        },
        defaults() { }
    });
    return groups;
}
exports.getGroupsInfo = getGroupsInfo;
function renumberGroups(re) {
    return getGroupsInfo(re, true);
}
exports.renumberGroups = renumberGroups;
//# sourceMappingURL=AST.js.map