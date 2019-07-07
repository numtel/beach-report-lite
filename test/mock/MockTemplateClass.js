const EventEmitter = require('events');

module.exports = class MockTemplateClass extends EventEmitter {
  constructor() {
    super();
    const parent = this;

    this.TemplateClass = class MockTemplate {
      constructor(filename) {
        this.filename = filename;
      }
      render(ctx) {
        parent.emit('render', this.filename, ctx);
        return this.filename;
      }
    };
  }
}
