// @flow

import type Redis from 'ioredis';
import type { TagSetInterface } from '../types/common';

const { v4: uuid } = require('uuid');

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
   * @inheritDoc
   */
  constructor(store: Redis, names: Array<string>) {
    this.store = store;
    this.names = names;
  }

  /**
   * @inheritDoc
   */
  reset(): Promise<void> {
    // Generate new IDs for all the names and set them all at the same time.
    const tuples = this.getNames().map(name => [
      this.tagKey(name),
      uuid().replace(/-/g, ''),
    ]);
    return this.store.mset(...tuples).then(() => {});
  }

  /**
   * @inheritDoc
   */
  resetTag(name: string): Promise<string> {
    const id = uuid().replace(/-/g, '');
    return this.store.set(name, id).then(() => id);
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
   * Get an array of tag identifiers for all of the tags in the set.
   *
   * @return {Promise<string[]>}
   *
   * @protected
   */
  tagIds(): Promise<Array<string>> {
    const names = this.getNames();
    const tagKeys = names.map(name => this.tagKey(name));
    return this.store.mget(tagKeys).then(tags => {
      // If there is a tag associated to the name, get it. If not, create it.
      const fillTags = (tag, index) => tag ? Promise.resolve(tag) : this.resetTag(tagKeys[index]);
      const promises = tags.map(fillTags);
      return Promise.all(promises);
    });
  }

  /**
   * @inheritDoc
   */
  tagId(name: string): Promise<string> {
    const key = this.tagKey(name);
    return this.store.get(key) || this.resetTag(key);
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
