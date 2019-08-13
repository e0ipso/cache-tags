// @flow

import type Redis from 'ioredis';
import type {
  DebouncerInterface,
  TagSetInterface,
  redisTimeUnit,
} from '../types/common';

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
    this.debouncer = new Debouncer(store);
  }

  /**
   * @inheritDoc
   */
  reset(): Promise<void> {
    // Generate new IDs for all the names and set them all at the same time.
    return Promise.all(
      this.getNames()
        .map(name => [this.tagKey(name), uuid().replace(/-/g, '')])
        .map(tuple => this.store.set(...tuple))
    ).then(() => {});
  }

  /**
   * @inheritDoc
   */
  async initTag(
    name: string,
    timeUnit: ?redisTimeUnit,
    ttl: ?number
  ): Promise<string> {
    const id = uuid().replace(/-/g, '');
    const res = await this.store.setnx(name, id);

    // If ttl is set, reset the expire for the tag regardless whether or not it
    // already exists.
    if (timeUnit && ttl) {
      if (timeUnit === 'EX') {
        await this.store.expire(name, ttl);
      } else {
        await this.store.pexpire(name, ttl);
      }
    }

    // setnx returns 1 if the key did not exist and was able to set it, 0 if
    // it could not set the key.
    if (res) {
      return id;
    }
    return this.debouncer.debounce('get', name);
  }

  /**
   * @inheritDoc
   */
  getNamespace(timeUnit: ?redisTimeUnit, ttl: ?number): Promise<string> {
    if (this.namespace) {
      return Promise.resolve(this.namespace);
    }
    return this.tagIds(timeUnit, ttl).then(ids => {
      this.namespace = ids.join('|');
      return this.namespace;
    });
  }

  /**
   * @inheritDoc
   */
  tagIds(timeUnit: ?redisTimeUnit, ttl: ?number): Promise<Array<string>> {
    const names = this.getNames();
    const tagKeys = names.map(name => this.tagKey(name));
    return Promise.all(
      tagKeys.map(k => this.debouncer.debounce('get', k))
    ).then(tags => {
      // If there is a tag associated to the name, get it. If not, create it.
      const fillTags = (tag: string, index: number) =>
        tag
          ? Promise.resolve(tag)
          : this.initTag(tagKeys[index], timeUnit, ttl);
      const promises = tags.map((t, index) => fillTags(t, index));
      return Promise.all(promises);
    });
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
