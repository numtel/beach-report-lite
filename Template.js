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
##else##
  <html for when no items>
##/##

*/

module.exports = class Template {
  constructor(filename) {
    // Parse from file
    const raw = fs.readFileSync(filename, 'utf8').split('##');
    let curBlock = this.parsed = { children: [] };

    for(let i = 0; i < raw.length; i++) {
      const expr = raw[i];
      if(expr.substr(0,1) === '=') {
        // Escaped expression block
        addChild(curBlock, ctx => htmlEscape(ctxEval(expr.substr(1), ctx)));
      } else if(expr === '/') {
        // End of if/each block
        if(!('parent' in curBlock))
          throw new TemplateParseError(filename, raw, i, 'too_many_endings');
        curBlock = curBlock.parent;
      } else if(expr === 'else') {
        if(!('parent' in curBlock))
          throw new TemplateParseError(filename, raw, i, 'else_not_allowed');
        if('elseChildren' in curBlock)
          throw new TemplateParseError(filename, raw, i, 'only_one_else_allowed')
        curBlock.elseChildren = [];
      } else if(expr.substr(0,3) === 'if ') {
        // Set curBlock to this new block so subsequent blocks are children
        curBlock = addChild(curBlock, (ctx, block) =>
          renderChildren(ctxEval(expr.substr(3), ctx) ? block.children : block.elseChildren, ctx));
      } else if(expr.substr(0,5) === 'each ') {
        const refNameStart = expr.lastIndexOf(' as ');
        const refName = expr.substr(refNameStart + 4).trim();
        if(refNameStart === -1 || !refName)
          throw new TemplateParseError(filename, raw, i, 'item_reference_name_required');
        if(!refName.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/))
          throw new TemplateParseError(filename, raw, i, 'invalid_item_reference_name');

        // Set curBlock to this new block so subsequent blocks are children
        curBlock = addChild(curBlock, (ctx, block) => {
          const items = ctxEval(expr.substr(5, refNameStart - 5), ctx);

          if(items.length === 0)
            return renderChildren(block.elseChildren, ctx);

          let out = '';
          for(let i=0; i<items.length; i++) {
            out += renderChildren(block.children, { ...ctx, [refName]: items[i]});
          }
          return out;
        });
      } else {
        // Standard HTML block
        addChild(curBlock, expr);
      }
    }
  }
  render(ctx) {
    return renderChildren(this.parsed.children, ctx);
  }
}

class TemplateParseError extends Error {
  constructor(filename, raw, index, msg) {
    let lineCount = 1;
    for(let i = 0; i<index + 1; i++) {
      lineCount += raw[i].split('\n').length - 1;
    }
    super('Template Parse Error: ' + msg + ' (' + filename + ':' + lineCount + ')');
    this.filename = filename;
    this.line = lineCount;
    this.type = msg;
  }
}

function addChild(parent, fun) {
  const block = { parent, fun };

  if('children' in parent) {
    (parent.elseChildren || parent.children).push(block);
  } else {
    parent.children = [ block ];
  }

  return block;
}

function renderChildren(blocks, ctx) {
  let out = '';
  if(blocks) {
    for(let i=0; i<blocks.length; i++) {
      out += typeof blocks[i].fun === 'function' ? blocks[i].fun(ctx, blocks[i]) : blocks[i].fun;
    }
  }
  return out;
}

function ctxEval(expr, ctx) {
  // Can't evaluate expr during parse since we don't want to make the ctx keys static
  return (new Function(...Object.keys(ctx), 'return '+ expr))(...Object.values(ctx));
}
function htmlEscape(str) {
  if(typeof str === 'number') return '' + str;
  if(typeof str === 'undefined' || str === null) return '';
  return str.replace(/&/g, '&amp;') // first!
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;');
}
