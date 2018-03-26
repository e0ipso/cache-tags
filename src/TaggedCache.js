// @flow

import typeof Redis from 'ioredis';
import type { TagSetInterface } from '../types/common';

const sha1 = require('sha1');

class TaggedCache {
  /**
   * The redis store.
   *
   * @var {Redis}
   */
  store: Redis;

  /**
   * The tag set instance.
   *
   * @var {TagSetInterface}
   */
  tags: TagSetInterface;

  /**
   * The key prefix for tags.
   *
   * @var {string}
   */
  tagPrefix: string;

  /**
   * Create a new tagged cache instance.
   *
   * @param {Redis} store
   * @param {TagSetInterface} tags
   * @return {void}
   */
  constructor(store: Redis, tags: TagSetInterface): void {
    this.store = store;
    this.tags = tags;
    this.tagPrefix = 'tags/';
  }

  /**
   * Increment the value of an item in the cache.
   *
   * @param {string} key
   * @param {*} value
   * @return {Promise<void>}
   */
  increment(key: string, value: any = 1): Promise<void> {
    return this.store.incrby(this.itemKey(key), value).then(() => {});
  }

  /**
   * Decrement the value of an item in the cache.
   *
   * @param {string} key
   * @param {*} value
   * @return {Promise<void>}
   */
  decrement(key: string, value: any = 1): Promise<void> {
    return this.store.decrby(this.itemKey(key), value).then(() => {});
  }

  /**
   * Remove all items from the cache.
   *
   * @return {Promise<void>}
   */
  flush(): Promise<void> {
    return this.tags.reset().then(() => {});
  }

  /**
   * {@inheritdoc}
   */
  itemKey(key: string): Promise<string> {
    return this.taggedItemKey(key);
  }

  /**
   * Get a fully qualified key for a tagged item.
   *
   * @param {string} key
   * @return {Promise<string>}
   */
  taggedItemKey(key: string): Promise<string> {
    return this.tags.getNamespace().then(ns => `${sha1(ns)}:${key}`);
  }

  /**
   * Retrieve an item from the cache by key.
   *
   * @param {string} key
   * @return {Promise<Object>}
   */
  get(key: string): Promise<any> {
    return this.itemKey(key).then(tKey => this.store.get(tKey));
  }

  /**
   * Retrieve multiple items from the cache by key.
   *
   * Items not found in the cache will have a null value.
   *
   * @param {string[]} keys
   * @return {Promise<Object>}
   */
  getMultiple(keys: Array<string>): Promise<{ [string]: any }> {
    return Promise.all(keys.map(key => this.itemKey(key)))
      .then((tKeys => this.store.mget(tKeys)));
  }

  /**
   * Store an items in the cache for a given number of seconds.
   *
   * @param {Object} values
   * @param {int} ttl
   * @return {void}
   */
  set(key: string, value: any, ttl: ?number): Promise<void> {
    return this.itemKey(key).then(tKey => {
      let args = [tKey, value];
      if (ttl) {
        args = [...args, 'PX', ttl * 1000];
      }
      return this.store.set(...args);
    });
  }

  /**
   * Store multiple items in the cache for a given number of seconds.
   *
   * @param {Object} values
   * @param {int} ttl
   * @return {void}
   */
  setMultiple(values: {[string]: any}, ttl: ?number): Promise<void> {
    return Promise.all(Object.keys(values).map(
      key => this.itemKey(key) .then(tKey => [tKey, values[key]])
    ))
      .then(tuples => {
        if (ttl) {
          // Since we cannot use mset we will use a pipeline.
          const pipeline = this.store.pipeline();
          const millis = ttl * 1000;
          tuples.forEach(([key, value]) =>
            pipeline.set(key, value, 'PX', millis));
          return pipeline.exec();
        }
        // If there is no TTL we can set them using the mset command.
        return this.store.mset(tuples);
      })
      .then(() => {});
  }

  /**
   * Delete an items in the cache.
   *
   * @param {string} key
   * @return {void}
   */
  delete(key: string): Promise<void> {
    return this.itemKey(key).then(this.store.del).then(() => {});
  }

  /**
   * Store multiple items in the cache.
   *
   * @param {string[]} keys
   * @return {void}
   */
  deleteMultiple(keys: Array<string>): Promise<void> {
    return Promise.all(keys.map(this.itemKey))
      .then(this.store.del)
      .then(() => {});
  }

  /**
   * Remove all items from the cache.
   *
   * @return {bool}
   */
  clear(): Promise<void> {
    return this.store.flushdb();
  }

  /**
   * Store an item in the cache if the key does not exist.
   *
   * @param string key
   * @param mixed value
   * @param {number} ttl
   * @return {Promise<void>}
   */
  add(key: string, value: any, ttl: ?number): Promise<void> {
    return this.itemKey(key)
      .then(tKey => {
        let args = [tKey, value, 'NX'];
        if (ttl) {
          args = [...args, 'PX', ttl * 1000];
        }
        return this.store.set(...args);
      });
  }
}

module.exports = TaggedCache;
