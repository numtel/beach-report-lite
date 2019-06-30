const fs = require('fs');

/* Hash block HTML Template Parser

constructor(filename : String)
  Create instance to parse HTML template file
render(ctx : Object)
  Render parsed template as string using context argument

Escaped HTML Value
==================
##=<expression>##

Conditional
===========
##if <expression>##
  <html when true>
##else##
  <html when false>
##/##

Mapping
=======
##each <expression> as <reference>##
  <html for each item>
##/##

*/

module.exports = class Template {
  constructor(filename) {
    // Parse hash-block html template from file
    const raw = fs.readFileSync(filename, 'utf8').split('##');
    const out =  { curPushKey: 'children', children: [] };
    let curBlock = out;
    for(let i = 0; i < raw.length; i++) {
      const expr = raw[i];
      if(expr.substr(0,1) === '=') {
        // Escaped expression block
        curBlock[curBlock.curPushKey].push({
          fun: ctx => Template.htmlEscape(Template.ctxEval(expr.substr(1), ctx))
        });
      } else if(expr === '/') {
        // End of if/each block
        if(!curBlock.parent)
          throw new Error('too_many_endings');

        curBlock = curBlock.parent;
      } else if(expr === 'else') {
        if(!curBlock.elseChildren)
          throw new Error('not_inside_if');
        if(curBlock.curPushKey === 'elseChildren')
          throw new Error('only_one_else_allowed')

        curBlock.curPushKey = 'elseChildren';
      } else if(expr.substr(0,3) === 'if ') {
        const newBlock = {
          fun: function If(ctx, block) {
            return (Template.ctxEval(expr.substr(3), ctx) ? block.children : block.elseChildren)
              .map(blockInner => blockInner.fun(ctx, blockInner)).join('');
          },
          curPushKey: 'children',
          children: [],
          elseChildren: [],
          parent: curBlock,
        };
        curBlock[curBlock.curPushKey].push(newBlock);
        curBlock = newBlock;
      } else if(expr.substr(0,5) === 'each ') {
        const refNameStart = expr.lastIndexOf(' as ');
        if(refNameStart === -1)
          throw new Error('item_reference_required');

        const refName = expr.substr(refNameStart + 4);
        const exprEach = expr.substr(5,refNameStart - 5);

        const newBlock = {
          fun: function Each(ctx, block) {
            return Template.ctxEval(exprEach, ctx).map(item => {
              return block.children.map(blockInner => {
                return blockInner.fun({ ...ctx, [refName]: item}, blockInner)
              }).join('');
            }).join('');
          },
          curPushKey: 'children',
          children: [],
          parent: curBlock,
        };
        curBlock[curBlock.curPushKey].push(newBlock);
        curBlock = newBlock;
      } else {
        // Standard HTML block
        curBlock[curBlock.curPushKey].push({ fun: () => expr });
      }
    }
    this.tpl = out.children;
  }
  render(ctx) {
    return this.tpl.map(block => block.fun(ctx, block)).join('');
  }
  static ctxEval(expr, ctx) {
    return (new Function(...Object.keys(ctx), 'return '+ expr))(...Object.values(ctx));
  }
  static htmlEscape(str) {
    if(typeof str === 'number') return '' + str;
    if(typeof str === 'undefined' || str === null) return '';
    return str.replace(/&/g, '&amp;') // first!
              .replace(/>/g, '&gt;')
              .replace(/</g, '&lt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/`/g, '&#96;');
  }
}
