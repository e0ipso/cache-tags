// @flow

import typeof Redis from 'ioredis';
import type { DebouncerInterface, TagSetInterface } from '../types/common';

const _ = require('lodash');
const Debouncer = require('./Debouncer');

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
   * The debouncer.
   *
   * @var {DebouncerInterface}
   */
  debouncer: DebouncerInterface;

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
    this.debouncer = new Debouncer(new Map(), store);
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
  itemKey(key: string): string {
    return this.taggedItemKey(key);
  }

  /**
   * Get a fully qualified key for a tagged item.
   *
   * @param {string} key
   * @return {string}
   */
  taggedItemKey(key: string): string {
    return key;
  }

  /**
   * Retrieve an item from the cache by key.
   *
   * @param {string} key
   * @return {Promise<Object>}
   */
  get(key: string): Promise<any> {
    return this.debounce('get', this.itemKey(key));
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
    const tKeys = keys.map(k => this.itemKey(k));
    return Promise.all(tKeys.map(tKey => this.debounce('get', tKey)))
      .then(values => _.zipObject(tKeys, values));
  }

  /**
   * Store an item in the cache.
   *
   * Takes the same arguments as ioredis set calls.
   *
   * @param {key} key
   * @param {*} value
   * @param {Array<*>} additionalArgs
   * @return {void}
   */
  set(key: string, value: any, ...additionalArgs: [string, number]): Promise<void> {
    const tKey = this.itemKey(key);
    let args = [tKey, value];
    if (additionalArgs.length) {
      args = [...args, ...additionalArgs];
    }
    return this.store.set(...args);
  }

  /**
   * Store an item in the cache for a number of seconds.
   *
   * Takes the same arguments as ioredis set calls.
   *
   * @param {key} key
   * @param {*} value
   * @param {int} ttlSeconds
   * @return {void}
   */
  setex(key: string, ttlSeconds: number, value: any): Promise<void> {
    return this.set(key, value, 'EX', ttlSeconds);
  }

  /**
   * Store an item in the cache for a number of milliseconds.
   *
   * Takes the same arguments as ioredis set calls.
   *
   * @param {key} key
   * @param {*} value
   * @param {int} ttlMillis
   * @return {void}
   */
  psetex(key: string, ttlMillis: number, value: any): Promise<void> {
    return this.set(key, value, 'PX', ttlMillis);
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
      key => [this.itemKey(key), values[key]]
    ))
      .then(tuples => Promise.all(tuples.map(([key, value]) => {
        const args = [key, value];
        if (ttl) {
          args.push('PX');
          args.push(ttl * 1000);
        }
        return this.store.set(...args);
      })))
      .then(() => {});
  }

  /**
   * Delete an items in the cache.
   *
   * @param {string} key
   * @return {void}
   */
  delete(key: string): Promise<void> {
    return this.store.del(this.itemKey(key)).then(() => {});
  }

  /**
   * Store multiple items in the cache.
   *
   * @param {string[]} keys
   * @return {void}
   */
  deleteMultiple(keys: Array<string>): Promise<void> {
    return Promise.all(
      keys.map(k => this.itemKey(k)).map(k => this.store.del(k))
    ).then(() => {});
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
    let args = [this.itemKey(key), value, 'NX'];
    if (ttl) {
      args = [...args, 'PX', ttl * 1000];
    }
    return this.store.set(...args);
  }

  /**
   * De-bounces a Redis command returning an instance of the in-flight promise.
   *
   * Only use with idempotent commands.
   *
   * @param {string} command
   *   The Redis command.
   * @param {any[]} args
   *   The parameters accepted by the command.
   *
   * @return {Promise<*>}
   *   The promise for the redis command.
   */
  debounce(command: string, ...args: Array<any>): Promise<*> {
    return this.debouncer.debounce(command, ...args);
  }
}

module.exports = TaggedCache;
