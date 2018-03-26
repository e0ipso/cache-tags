// @flow

import type Redis from 'ioredis';
import typeof Redlock from 'redlock';
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
   * Lock manager.
   *
   * @var Redlock
   */
  redlock: Redlock;

  /**
   * The TTL for dead locks.
   *
   * @var {int}
   */
  lockTtl: number;

  /**
   * @inheritDoc
   */
  constructor(store: Redis, names: Array<string>, redlock: Redlock) {
    this.store = store;
    this.names = names;
    this.redlock = redlock;
    this.lockTtl = 1000;
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
    // If there is a tag associated to the name, get it. If not, create it.
    const fillTags = (tag, name) => tag ? Promise.resolve(tag) : this.resetTag(this.tagKey(name));
    const promises = names.map(name => {
      const tagKey = this.tagKey(name);
      const lockKey = this.lockKey(tagKey);
      return this.redlock.lock(lockKey, this.lockTtl).then((lock) =>
        this.store.get(tagKey).then((tag) =>
          // Generate missing tags and unlock.
          fillTags(tag, name).then((newTag) => {
            lock.unlock();
            return newTag;
          }))
      );
    });
    return Promise.all(promises);
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

  /**
   * Generates the resorce name to lock for a tag.
   *
   * @param {string} tagKey
   * @returns {string}
   *   The lock key.
   */
  lockKey(tagKey: string): string {
    return `${tagKey}:lock`;
  }
}

module.exports = TagSet;
