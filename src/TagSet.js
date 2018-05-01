// @flow

import type Redis from 'ioredis';
import type { DebouncerInterface, TagSetInterface } from '../types/common';

const { v4: uuid } = require('uuid');
const Debouncer = require('./Debouncer');

class TagSet implements TagSetInterface {
  /**
   * The store.
   *
   * @var {Redis}
   */
  store: Redis;

  /**
   * The tag names.
   *
   * @var array
   */
  names: Array<string>;

  /**
   * The namespace.
   *
   * @var string
   */
  namespace: string;

  /**
   * The debouncer.
   *
   * @var {DebouncerInterface}
   */
  debouncer: DebouncerInterface;

  /**
   * @inheritDoc
   */
  constructor(store: Redis, names: Array<string>) {
    this.store = store;
    this.names = names;
    this.debouncer = new Debouncer(new Map(), store);
  }

  /**
   * @inheritDoc
   */
  reset(): Promise<void> {
    // Generate new IDs for all the names and set them all at the same time.
    return Promise.all(this.getNames()
      .map(name => [
        this.tagKey(name),
        uuid().replace(/-/g, ''),
      ])
      .map(tuple => this.store.set(...tuple)))
      .then(() => {});
  }

  /**
   * @inheritDoc
   */
  initTag(name: string): Promise<string> {
    const id = uuid().replace(/-/g, '');
    return this.store.setnx(name, id)
      .then(res => res ? id : this.debouncer.debounce('get', name));
  }

  /**
   * @inheritDoc
   */
  getNamespace(): Promise<string> {
    if (this.namespace) {
      return Promise.resolve(this.namespace);
    }
    return this.tagIds().then(ids => {
      this.namespace = ids.join('|');
      return this.namespace;
    });
  }

  /**
   * @inheritDoc
   */
  tagIds(): Promise<Array<string>> {
    const names = this.getNames();
    const tagKeys = names.map(name => this.tagKey(name));
    return Promise.all(tagKeys.map(k => this.debouncer.debounce('get', k)))
      .then(tags => {
        // If there is a tag associated to the name, get it. If not, create it.
        const fillTags = (tag: string, index: number) => tag
          ? Promise.resolve(tag)
          : this.initTag(tagKeys[index]);
        const promises = tags.map((t, index) => fillTags(t, index));
        return Promise.all(promises);
      });
  }

  /**
   * @inheritDoc
   */
  tagId(name: string): Promise<string> {
    const key = this.tagKey(name);
    return this.debouncer.debounce('get', key) || this.initTag(key);
  }

  /**
   * @inheritDoc
   */
  tagKey(name: string): string {
    return `tag:${name}:key`;
  }

  /**
   * @inheritDoc
   */
  getNames(): Array<string> {
    return this.names;
  }
}

module.exports = TagSet;
