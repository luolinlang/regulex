"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voidElementTagTuple = [
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
];
const _htmlTags = 'a,abbr,address,applet,area,article,aside,audio,b,base,basefont,bdi,bdo,blockquote,body,br,button,canvas,caption,cite,code,col,colgroup,data,datalist,dd,del,details,dfn,dialog,dir,div,dl,dt,em,embed,fieldset,figcaption,figure,font,footer,form,frame,frameset,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,i,iframe,img,input,ins,kbd,label,legend,li,link,main,map,mark,marquee,menu,meta,meter,nav,noscript,object,ol,optgroup,option,output,p,param,picture,pre,progress,q,rp,rt,ruby,s,samp,script,section,select,slot,small,source,span,strong,style,sub,summary,sup,table,tbody,td,template,textarea,tfoot,th,thead,time,title,tr,track,u,ul,var,video,wbr';
exports.htmlTags = _htmlTags.split(',');
exports.h = {
    frag(...children) {
        let a = document.createDocumentFragment();
        appends(a, children);
        return a;
    }
};
exports.htmlTags.forEach(tag => {
    exports.h[tag] = (...args) => t(tag, ...args);
});
function t(tag, attrs, ...children) {
    if (attrs instanceof HTMLElement || typeof attrs === 'string') {
        children.unshift(attrs);
        attrs = undefined;
    }
    let a = document.createElement(tag);
    if (attrs) {
        if (attrs.style) {
            for (let p in attrs.style) {
                a.style[p] = attrs.style[p];
            }
            delete attrs.style;
        }
        for (let k in attrs) {
            a[k] = attrs[k];
        }
    }
    appends(a, children);
    return a;
}
exports.t = t;
function appends(a, children) {
    for (let child of children) {
        if (typeof child === 'string') {
            if (child) {
                a.appendChild(document.createTextNode(child));
            }
        }
        else {
            a.appendChild(child);
        }
    }
}
//# sourceMappingURL=HTML.js.map