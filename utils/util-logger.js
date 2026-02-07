'use strict';

module.exports = function(args) {
  this.tags = [];
  Object.assign(this, args);
  if (!Array.isArray(this.tags)) {
    this.tags = [this.tags];
  }
  this.addTags = function() {
    let args = arguments;
    if (this.tags.length) {
      args = this.tags.concat(...args);
    }
    return args;
  };
  this.log = function() {
    console.log(...this.addTags(...arguments));
  };
  this.error = function() {
    console.error(...this.addTags(...arguments));
  };
  this.info = function() {
    console.info(...this.addTags(...arguments));
  };
  this.warn = function() {
    console.warn(...this.addTags(...arguments));
  };
};