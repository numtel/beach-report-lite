const fs = require('fs');

// Super-simple ejs style templates
const TAG_START = '<%';
const TAG_END = '%>';

module.exports = class Template {
  constructor(filename) {
    const raw = fs.readFileSync(filename, 'utf8').split(TAG_START);
    this.parsed = 'let __out=`' + backtickEscape(raw[0]) + '`;';

    for(let i = 1; i < raw.length; i++) {
      const tagEnd = raw[i].indexOf(TAG_END);

      if(tagEnd === -1)
        throw new Error('missing_control_tag_ending');

      const expr = raw[i].substr(0, tagEnd);
      const after = raw[i].substr(tagEnd + TAG_END.length);

      if(expr.substr(0,1) === '=') {
        this.parsed += '__out+=__escape(' + expr.substr(1) + ');';
      } else {
        this.parsed += expr;
      }
      this.parsed += '__out+=`' + backtickEscape(after) + '`;';
    }
    this.parsed += 'return __out;';
  }
  render(ctx) {
    return (new Function(...Object.keys(ctx), '__escape', this.parsed))(...Object.values(ctx), htmlEscape);
  }
}

function backtickEscape(str) {
  return str.replace(/`/g, '\\`');
}

function htmlEscape(str) {
  if(typeof str !== 'string') str = String(str);
  return str.replace(/&/g, '&amp;') // first!
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;');
}
