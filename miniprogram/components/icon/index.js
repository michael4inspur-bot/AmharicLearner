const { dataUri } = require('./icons.js');

Component({
  properties: {
    name: { type: String, value: 'spark' },
    size: { type: Number, value: 40 },
    color: { type: String, value: '#3B2F2A' }
  },
  data: { src: '' },
  observers: {
    'name, color': function (name, color) {
      this.setData({ src: dataUri(name, color) });
    }
  },
  lifetimes: {
    attached() { this.setData({ src: dataUri(this.data.name, this.data.color) }); }
  }
});
